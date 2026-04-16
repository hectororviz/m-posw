import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import type { PollTransferResponse } from './dto/transfer.dto';

interface MPPayment {
  id: string | number;
  status: string;
  transaction_amount: number;
  payer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  payment_method_id?: string;
  operation_type?: string;
  date_created?: string;
  date_approved?: string;
}

interface MPResponse {
  results?: MPPayment[];
}

@Injectable()
export class PaymentsService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 8000;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly seenPaymentIds = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async pollTransfer(montoEsperado: number, userId: string): Promise<PollTransferResponse> {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new Error('MP_ACCESS_TOKEN no configurado');
    }

    // Calculate time range (last 2 minutes)
    const now = new Date();
    const beginDate = new Date(now.getTime() - 2 * 60 * 1000);
    
    const beginDateISO = beginDate.toISOString();
    const endDateISO = now.toISOString();

    // Build URL with query params
    const url = new URL(`${this.baseUrl}/v1/payments/search`);
    url.searchParams.append('range', 'date_created');
    url.searchParams.append('begin_date', beginDateISO);
    url.searchParams.append('end_date', endDateISO);
    url.searchParams.append('sort', 'date_created');
    url.searchParams.append('criteria', 'desc');
    url.searchParams.append('limit', '10');
    url.searchParams.append('status', 'approved');

    this.logger.debug(`Polling MP transfers: ${url.toString()}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const data = (await response.json()) as MPResponse;

      if (!response.ok) {
        this.logger.error(`MP API error: ${response.status}`, data);
        throw new Error(`MercadoPago API error: ${response.status}`);
      }

      const payments = data.results || [];
      
      // Filter for CVU/transfer payments
      const transferPayments = payments.filter((payment) => {
        // Only CVU transfers or money transfers
        const isTransfer = 
          payment.payment_method_id === 'cvu' || 
          payment.operation_type === 'money_transfer';
        
        if (!isTransfer) return false;
        
        // Skip already processed payments for this session
        const paymentId = String(payment.id);
        if (this.seenPaymentIds.has(paymentId)) return false;
        
        return true;
      });

      if (transferPayments.length === 0) {
        return { hay_pago: false };
      }

      // Get the most recent payment
      const payment = transferPayments[0];
      const paymentId = String(payment.id);
      
      // Check if already stored in DB
      const existing = await this.prisma.movimientoMP.findUnique({
        where: { paymentId },
      });

      if (existing?.notificado) {
        // Already processed, skip it
        this.seenPaymentIds.add(paymentId);
        return { hay_pago: false };
      }

      // Format payer name
      const payerName = payment.payer 
        ? [payment.payer.first_name, payment.payer.last_name].filter(Boolean).join(' ') || payment.payer.email
        : undefined;

      this.logger.log(`Found transfer payment: ${paymentId}, amount: ${payment.transaction_amount}`);

      return {
        hay_pago: true,
        monto: payment.transaction_amount,
        pagador: payerName,
        tipo: payment.payment_method_id === 'cvu' ? 'cvu' : 'transferencia',
        fecha: payment.date_approved || payment.date_created,
        payment_id: paymentId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout consultando MercadoPago');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async confirmTransfer(
    paymentId: string,
    montoRecibido: number,
    montoEsperado: number,
    userId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<{ success: boolean; saleId?: string; orderNumber?: number; message?: string }> {
    // Check if already processed
    const existing = await this.prisma.movimientoMP.findUnique({
      where: { paymentId },
      include: { sale: true },
    });

    if (existing?.procesado && existing.saleId) {
      // Already processed, return existing sale
      return {
        success: true,
        saleId: existing.saleId,
        orderNumber: existing.sale?.orderNumber,
        message: 'Pago ya procesado',
      };
    }

    // Create sale with transfer payment method
    const roundedTotal = Math.round(montoEsperado * 100) / 100;
    const roundedReceived = Math.round(montoRecibido * 100) / 100;

    // Build sale items
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      throw new Error('Producto inválido o inactivo');
    }

    const saleItems = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      
      const price = Number(product.price);
      const subtotal = Math.round(price * item.quantity * 100) / 100;

      // Get or create counter for this product
      const counter = await this.prisma.productOrderCounter.upsert({
        where: { productId: item.productId },
        update: { lastOrderNumber: { increment: 1 } },
        create: { productId: item.productId, lastOrderNumber: 1 },
      });

      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        subtotal,
        orderNumber: counter.lastOrderNumber,
      });
    }

    // Create the sale and movimiento in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          userId,
          total: roundedTotal,
          status: 'APPROVED' as const,
          paymentStatus: 'APPROVED' as const,
          paymentMethod: 'TRANSFER' as const,
          cashReceived: roundedReceived,
          changeAmount: 0,
          statusUpdatedAt: new Date(),
          paidAt: new Date(),
          items: {
            create: saleItems,
          },
        },
        include: { items: true },
      });

      // Create or update movimientoMP
      await tx.movimientoMP.upsert({
        where: { paymentId },
        create: {
          saleId: sale.id,
          paymentId,
          monto: roundedReceived,
          montoEsperado: roundedTotal,
          pagador: null, // We could fetch this from MP if needed
          tipo: 'cvu',
          fecha: new Date(),
          notificado: true,
          procesado: true,
        },
        update: {
          saleId: sale.id,
          notificado: true,
          procesado: true,
        },
      });

      return sale;
    });

    return {
      success: true,
      saleId: result.id,
      orderNumber: result.orderNumber,
    };
  }

  // Clear seen payment IDs when a session ends or periodically
  clearSeenPayments(): void {
    this.seenPaymentIds.clear();
    this.logger.log('Cleared seen payment IDs cache');
  }
}

import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { SalesService } from '../sales/sales.service';
import { InternetVouchersService } from '../internet-vouchers/internet-vouchers.service';
import { FinanzasService } from '../finanzas/finanzas.service';
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
    private mpConfig: MercadoPagoConfigService,
    private salesService: SalesService,
    private internetVouchers: InternetVouchersService,
    private finanzas: FinanzasService,
  ) {}

  async pollTransfer(montoEsperado: number, userId: string): Promise<PollTransferResponse> {
    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      throw new Error('MP access token no configurado (OAuth o .env)');
    }

    const now = new Date();
    const beginDate = await this.getPollCursor(now);
    const beginDateISO = beginDate.toISOString();
    const endDateISO = now.toISOString();

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (process.env.MP_INTEGRATOR_ID) {
      headers['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
    }

    try {
      const payments = await this.searchTransferPayments(headers, beginDateISO, endDateISO);

      // Filter for CVU/transfer payments
      const transferPayments = payments.filter((payment) => {
        const isTransfer =
          payment.payment_method_id === 'cvu' ||
          payment.operation_type === 'money_transfer';

        if (!isTransfer) {
          // Telemetría M3: medir métodos descartados para decidir si ampliar el filtro
          const paymentId = String(payment.id);
          if (!this.seenPaymentIds.has(`filtered:${paymentId}`)) {
            this.seenPaymentIds.add(`filtered:${paymentId}`);
            this.logger.debug(
              `TRANSFER_FILTERED_OUT id=${paymentId} method=${payment.payment_method_id ?? '?'} op=${payment.operation_type ?? '?'} status=${payment.status ?? '?'}`,
            );
          }
          return false;
        }

        const paymentId = String(payment.id);
        if (this.seenPaymentIds.has(paymentId)) return false;

        return true;
      });

      if (transferPayments.length === 0) {
        await this.savePollCursor(now);
        return { hay_pago: false };
      }

      // Get the most recent payment
      const payment = transferPayments[0];
      const paymentId = String(payment.id);

      // DB is source of truth (survives restarts, unlike seenPaymentIds)
      const existing = await this.prisma.movimientoMP.findUnique({
        where: { paymentId },
      });

      if (existing?.notificado || existing?.procesado) {
        this.seenPaymentIds.add(paymentId);
        await this.savePollCursor(now);
        return { hay_pago: false };
      }

      const payerName = payment.payer
        ? [payment.payer.first_name, payment.payer.last_name].filter(Boolean).join(' ') || payment.payer.email
        : undefined;

      this.logger.log(`Found transfer payment: ${paymentId}, amount: ${payment.transaction_amount}`);
      await this.savePollCursor(now);

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
    }
  }

  private async getPollCursor(now: Date): Promise<Date> {
    const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
    const MAX_WINDOW_MS = 15 * 60 * 1000;
    // Solape: MP puede tardar en indexar/aprobar un pago ya creado. Sin solape,
    // un pago creado cerca del fin de una ventana y aprobado después queda
    // invisible para siempre (incidente transferencia 2026-09-28). El dedup
    // (seenPaymentIds + movimientoMP) hace el solape seguro.
    const OVERLAP_MS = 3 * 60 * 1000;
    try {
      const setting = await this.prisma.setting.findFirst({
        select: { lastMpPollAt: true },
      });
      if (setting?.lastMpPollAt) {
        const cursor = new Date(setting.lastMpPollAt.getTime() - OVERLAP_MS);
        if (cursor > now) {
          return new Date(now.getTime() - 2 * 60 * 1000);
        }
        if (now.getTime() - cursor.getTime() > MAX_WINDOW_MS) {
          return new Date(now.getTime() - MAX_WINDOW_MS);
        }
        return cursor;
      }
    } catch {
      this.logger.warn('No se pudo leer lastMpPollAt, usando ventana por defecto');
    }
    return new Date(now.getTime() - DEFAULT_WINDOW_MS);
  }

  private async savePollCursor(at: Date): Promise<void> {
    try {
      await this.prisma.setting.updateMany({ data: { lastMpPollAt: at } });
    } catch {
      this.logger.warn('No se pudo persistir lastMpPollAt');
    }
  }

  private async searchTransferPayments(
    headers: Record<string, string>,
    beginDateISO: string,
    endDateISO: string,
  ): Promise<MPPayment[]> {
    const PAGE_LIMIT = 50;
    const MAX_PAGES = 3;
    const all: MPPayment[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${this.baseUrl}/v1/payments/search`);
      url.searchParams.append('range', 'date_created');
      url.searchParams.append('begin_date', beginDateISO);
      url.searchParams.append('end_date', endDateISO);
      url.searchParams.append('sort', 'date_created');
      url.searchParams.append('criteria', 'desc');
      url.searchParams.append('limit', String(PAGE_LIMIT));
      url.searchParams.append('offset', String(page * PAGE_LIMIT));
      url.searchParams.append('status', 'approved');

      if (page === 0) {
        this.logger.debug(`Polling MP transfers: ${url.toString()}`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        const data = (await response.json()) as MPResponse;
        if (!response.ok) {
          this.logger.error(`MP API error: ${response.status}`, data);
          throw new Error(`MercadoPago API error: ${response.status}`);
        }
        const results = data.results || [];
        all.push(...results);
        if (results.length < PAGE_LIMIT) {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    return all;
  }

  async confirmTransfer(
    paymentId: string,
    montoRecibido: number,
    montoEsperado: number,
    userId: string,
    items: { productId: string; quantity: number }[],
    discount?: { discountTotal?: number; socioId?: number; canjes?: { socioBeneficioId: string; montoDescontado: number }[] },
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

    const validatedDiscount = await this.salesService.resolveSocioDiscount(
      items,
      discount?.socioId,
      discount?.discountTotal,
      discount?.canjes,
    );
    // Create sale with transfer payment method
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
    let computedSubtotal = 0;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      const price = Number(product.price);
      const subtotal = Math.round(price * item.quantity * 100) / 100;
      computedSubtotal += subtotal;

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
    const roundedTotal = Math.round((computedSubtotal - validatedDiscount) * 100) / 100;
    if (Math.abs(roundedTotal - Math.round(montoEsperado * 100) / 100) > 0.05) {
      throw new Error('El total no coincide con los items y descuentos');
    }

    // Reserve paymentId FIRST (anti double-confirm concurrente: @@unique(paymentId)).
    // Si otro request lo reservó, P2002 → devolver la venta existente o 409 si aún no terminó.
    try {
      await this.prisma.movimientoMP.create({
        data: {
          paymentId,
          monto: roundedReceived,
          montoEsperado: roundedTotal,
          pagador: null,
          tipo: 'cvu',
          fecha: new Date(),
          notificado: true,
          procesado: false,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.movimientoMP.findUnique({
          where: { paymentId },
          include: { sale: true },
        });
        if (concurrent?.procesado && concurrent.saleId) {
          return {
            success: true,
            saleId: concurrent.saleId,
            orderNumber: concurrent.sale?.orderNumber,
            message: 'Pago ya procesado',
          };
        }
        if (concurrent && !concurrent.procesado && !concurrent.saleId) {
          this.logger.warn(`Reserva previa sin venta paymentId=${paymentId}, completando venta`);
        } else {
          throw new ConflictException('Pago en proceso de confirmación, reintente');
        }
      }
      throw error;
    }

    // Create the sale and link movimiento in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
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

      await tx.movimientoMP.upsert({
        where: { paymentId },
        create: {
          saleId: sale.id,
          paymentId,
          monto: roundedReceived,
          montoEsperado: roundedTotal,
          pagador: null,
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

    this.logger.log(`Venta transferencia creada saleId=${result.id}, decrementando stock...`);
    await this.salesService.decrementStockForSale(result.id);
    await this.finanzas.recordVenta(result.id).catch((e) => this.logger.warn(`recordVenta ${result.id}: ${e}`));
    this.logger.log(`Stock decrementado para venta transferencia saleId=${result.id}`);

    const vouchers = await this.internetVouchers.generateVouchersForSale(result.id);
    if (vouchers.length > 0) {
      this.logger.log(`${vouchers.length} voucher(s) generado(s) para venta transferencia saleId=${result.id}`);
    }

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

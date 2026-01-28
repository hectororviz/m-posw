import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sale, SaleItem } from '@prisma/client';

interface CreateOrderInput {
  externalStoreId: string;
  externalPosId: string;
  sale: Sale & { items: (SaleItem & { product: { name: string; price: unknown } })[] };
}

interface OrderIdentity {
  externalStoreId: string;
  externalPosId: string;
}

@Injectable()
export class MercadoPagoInstoreService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 8000;

  constructor(private config: ConfigService) {}

  async createOrUpdateOrder(input: CreateOrderInput) {
    const path = this.orderPath(input.externalStoreId, input.externalPosId);
    const total = Number(input.sale.total);
    const items = input.sale.items.map((item) => ({
      title: item.product.name,
      quantity: item.quantity,
      unit_price: Number(item.subtotal) / item.quantity,
    }));

    const payload = {
      external_reference: input.sale.id,
      transaction_amount: total,
      items,
    };

    await this.request('PUT', path, payload);
  }

  async deleteOrder(input: OrderIdentity) {
    const path = this.orderPath(input.externalStoreId, input.externalPosId);
    await this.request('DELETE', path);
  }

  async getPayment(paymentId: string) {
    const path = `/v1/payments/${paymentId}`;
    return this.request('GET', path);
  }

  private orderPath(externalStoreId: string, externalPosId: string) {
    const collectorId = this.config.get<string>('MP_COLLECTOR_ID');
    if (!collectorId) {
      throw new HttpException('MP_COLLECTOR_ID no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return `/instore/orders/qr/seller/collectors/${collectorId}/stores/${externalStoreId}/pos/${externalPosId}`;
  }

  private async request(method: string, path: string, body?: Record<string, unknown>) {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new HttpException('MP_ACCESS_TOKEN no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new HttpException(
          `Mercado Pago error ${response.status}: ${text}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('No se pudo comunicar con Mercado Pago', HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timeout);
    }
  }
}

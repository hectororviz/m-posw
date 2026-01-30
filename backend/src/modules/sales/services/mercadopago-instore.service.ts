import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(MercadoPagoInstoreService.name);

  constructor(private config: ConfigService) {}

  async createOrUpdateOrder(input: CreateOrderInput) {
    const url = this.buildOrdersUrl(input.externalStoreId, input.externalPosId);
    this.parseNumber(input.sale.total, 'total');
    const items = input.sale.items.map((item) => {
      const quantityValue = this.parseNumber(item.quantity, 'quantity');
      const quantity = Math.trunc(quantityValue);
      if (!Number.isFinite(quantityValue) || quantity <= 0 || quantity !== quantityValue) {
        throw new HttpException('Cantidad inválida en los items de la venta', HttpStatus.BAD_REQUEST);
      }
      const hasSubtotal = item.subtotal !== null && item.subtotal !== undefined;
      const unitPrice = hasSubtotal
        ? this.parseNumber(item.subtotal, 'subtotal') / quantity
        : this.parseNumber(item.product?.price, 'price');
      if (!Number.isFinite(unitPrice)) {
        throw new HttpException('Precio inválido en los items de la venta', HttpStatus.BAD_REQUEST);
      }
      return {
        title: item.product.name,
        quantity,
        unit_price: unitPrice,
        unit_measure: 'unit',
      };
    });
    const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const totalAmount = Math.round((total + Number.EPSILON) * 100) / 100;

    const payload = {
      external_reference: `sale-${input.sale.id}`,
      total_amount: totalAmount,
      items,
    };

    this.logger.debug(
      `Mercado Pago request: PUT ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`,
    );
    await this.request('PUT', url, payload);
  }

  async deleteOrder(input: OrderIdentity) {
    const url = this.buildPosOrdersUrl(input.externalPosId);
    this.logger.debug(
      `Mercado Pago request: DELETE ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`,
    );
    await this.request('DELETE', url);
  }

  async getPayment(paymentId: string) {
    const url = `${this.baseUrl}/v1/payments/${paymentId}`;
    return this.request('GET', url);
  }

  /**
   * Instore QR v2 endpoints:
   * - PUT /instore/qr/seller/collectors/{user_id}/stores/{external_store_id}/pos/{external_pos_id}/orders
   * - DELETE /instore/qr/seller/collectors/{user_id}/pos/{external_pos_id}/orders
   */
  buildOrdersUrl(externalStoreId: string, externalPosId: string) {
    return `${this.baseUrl}/instore/qr/seller/collectors/${this.getCollectorId()}/stores/${externalStoreId}/pos/${externalPosId}/orders`;
  }

  buildPosOrdersUrl(externalPosId: string) {
    return `${this.baseUrl}/instore/qr/seller/collectors/${this.getCollectorId()}/pos/${externalPosId}/orders`;
  }

  private getCollectorId() {
    const collectorId = this.config.get<string>('MP_COLLECTOR_ID');
    if (!collectorId) {
      throw new HttpException('MP_COLLECTOR_ID no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return collectorId;
  }

  private async request(method: string, url: string, body?: Record<string, unknown>) {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new HttpException('MP_ACCESS_TOKEN no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
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
        this.logger.error(`Mercado Pago error ${response.status}: ${text}`);
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

  private parseNumber(value: unknown, field: string) {
    const parsed = this.toNumber(value);
    if (!Number.isFinite(parsed)) {
      throw new HttpException(`${field} inválido en la venta`, HttpStatus.BAD_REQUEST);
    }
    return parsed;
  }

  private toNumber(value: unknown) {
    if (value && typeof value === 'object' && 'toNumber' in value) {
      const maybeDecimal = value as { toNumber?: unknown };
      if (typeof maybeDecimal.toNumber === 'function') {
        return maybeDecimal.toNumber();
      }
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    return Number(value);
  }
}

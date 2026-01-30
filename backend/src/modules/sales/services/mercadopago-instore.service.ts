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

interface MercadoPagoOrderItem {
  sku_number: string;
  category: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_measure: string;
  currency_id: string;
  total_amount: number;
}

interface MercadoPagoOrderPayload {
  external_reference: string;
  total_amount: number;
  items: MercadoPagoOrderItem[];
}

@Injectable()
export class MercadoPagoInstoreService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 8000;
  private readonly logger = new Logger(MercadoPagoInstoreService.name);

  constructor(private config: ConfigService) {}

  async createOrUpdateOrder(input: CreateOrderInput) {
    const url = this.buildOrdersUrl(input.externalStoreId, input.externalPosId);
    this.assertExternalId('externalStoreId', input.externalStoreId);
    this.assertExternalId('externalPosId', input.externalPosId);
    const payload = this.buildPayload(input.sale);
    const itemsTotal = payload.items.reduce((sum, item) => sum + item.total_amount, 0);
    this.logger.debug(
      `Mercado Pago payload summary: total_amount=${payload.total_amount} items_len=${payload.items.length} items_sum=${this.roundToCurrency(
        itemsTotal,
      )}`,
    );
    this.logger.debug(
      `Mercado Pago request: PUT ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`,
    );
    await this.request('PUT', url, payload);
  }

  async deleteOrder(input: OrderIdentity) {
    const url = this.buildPosOrdersUrl(input.externalPosId);
    this.assertExternalId('externalStoreId', input.externalStoreId);
    this.assertExternalId('externalPosId', input.externalPosId);
    this.logger.debug(
      `Mercado Pago request: DELETE ${url} (collectorId=${this.getCollectorId()}, externalStoreId=${input.externalStoreId}, externalPosId=${input.externalPosId})`,
    );
    await this.request('DELETE', url);
  }

  async getPayment(paymentId: string) {
    const url = `${this.baseUrl}/v1/payments/${paymentId}`;
    return this.request('GET', url);
  }

  async getPosInfo(posId: string) {
    const url = `${this.baseUrl}/pos/${posId}`;
    return this.request('GET', url);
  }

  buildPayload(
    sale: Sale & { items: (SaleItem & { product: { name: string; price: unknown } })[] },
  ): MercadoPagoOrderPayload {
    this.parseNumber(sale.total, 'total');
    const currencyId = this.getCurrencyId();
    const items = sale.items.map((item) => {
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
      const title = item.product?.name ?? 'Producto';
      const description = item.product?.name ?? 'Producto';
      const skuNumber = item.productId ? String(item.productId) : `sale-item-${item.id}`;
      const totalAmount = this.roundToCurrency(unitPrice * quantity);
      return {
        sku_number: skuNumber,
        category: 'POS',
        title,
        description,
        quantity,
        unit_price: unitPrice,
        unit_measure: 'unit',
        currency_id: currencyId,
        total_amount: totalAmount,
      };
    });
    const totalAmount = this.roundToCurrency(
      items.reduce((sum, item) => sum + item.total_amount, 0),
    );
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new HttpException(
        `total_amount inválido en la venta (valor=${totalAmount})`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      external_reference: `sale-${sale.id}`,
      total_amount: totalAmount,
      items,
    };
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

  private getCurrencyId() {
    return this.config.get<string>('MP_CURRENCY_ID') || 'ARS';
  }

  private async request(method: string, url: string, body?: Record<string, unknown>) {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new HttpException('MP_ACCESS_TOKEN no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const hasBody = typeof body !== 'undefined';
    const payloadSummary = body
      ? {
          total_amount: (body as { total_amount?: unknown }).total_amount,
          items_length: Array.isArray((body as { items?: unknown }).items)
            ? (body as { items: unknown[] }).items.length
            : undefined,
          total_amount_type: typeof (body as { total_amount?: unknown }).total_amount,
        }
      : undefined;
    this.logger.debug(
      `Mercado Pago request dispatch: ${method} ${url} payload=${payloadSummary ? JSON.stringify(payloadSummary) : 'none'}`,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const jsonBody = hasBody ? JSON.stringify(body) : undefined;
    if (hasBody && !jsonBody) {
      throw new HttpException('Payload inválido para Mercado Pago', HttpStatus.BAD_REQUEST);
    }
    if (jsonBody) {
      const parsedBody = JSON.parse(jsonBody) as { total_amount?: unknown; items?: unknown };
      const jsonBodySummary = {
        total_amount: parsedBody.total_amount,
        items_length: Array.isArray(parsedBody.items) ? parsedBody.items.length : undefined,
        total_amount_type: typeof parsedBody.total_amount,
      };
      this.logger.debug(
        `Mercado Pago jsonBody summary: ${JSON.stringify(jsonBodySummary)}`,
      );
    }
    if (hasBody) {
      const totalAmount = (body as { total_amount?: unknown }).total_amount;
      if (totalAmount === null || typeof totalAmount === 'undefined') {
        throw new HttpException(
          'total_amount ausente en el payload para Mercado Pago',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (hasBody) {
        headers['Content-Type'] = 'application/json';
      }
      this.logger.debug(
        `Mercado Pago request config: ${method} ${url} body=${jsonBody ?? 'none'}`,
      );
      this.logger.error('MP_REQUEST_VERSION=2026-01-30-XYZ');
      const response = await fetch(url, {
        method,
        headers,
        body: jsonBody,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.error(`Mercado Pago error ${response.status}: ${text}`);
        throw new HttpException(
          `Mercado Pago error ${response.status} en ${method} ${url}: ${text}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `No se pudo comunicar con Mercado Pago al llamar ${method} ${url}`,
        HttpStatus.BAD_GATEWAY,
      );
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

  private roundToCurrency(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private assertExternalId(field: string, value: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new HttpException(
        `${field} requerido: configurá external IDs (external_pos_id/external_store_id)`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (/^\d+$/.test(normalized)) {
      throw new HttpException(
        `${field} inválido: parece un ID numérico. Configurá el external_id correspondiente en Mercado Pago`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

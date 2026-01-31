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
  title: string;
  description: string;
  total_amount: number;
  items: MercadoPagoOrderItem[];
  notification_url?: string;
}

@Injectable()
export class MercadoPagoInstoreService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 15000;
  private readonly logger = new Logger(MercadoPagoInstoreService.name);
  private readonly notificationUrl = 'https://pos.csdsoler.com.ar/api/webhooks/mercadopago';

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
      `Mercado Pago payload titles: title=${payload.title} first_item_title=${payload.items[0]?.title ?? 'n/a'}`,
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
    const saleIdLabel = sale.id ? String(sale.id).trim() : '';
    const saleTitle = this.ensureNonEmptyText(
      saleIdLabel ? `Venta ${saleIdLabel}` : 'Venta POS',
      'title',
    );
    const saleDescription = this.ensureNonEmptyText(
      saleIdLabel ? `Sale ${saleIdLabel}` : 'Sale POS',
      'description',
    );
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
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new HttpException('Precio inválido en los items de la venta', HttpStatus.BAD_REQUEST);
      }
      const title = this.normalizeText(item.product?.name, 'Item');
      const description = this.normalizeText(item.product?.name, 'Producto');
      const skuNumber = this.toSkuNumber(item.productId, item.id);
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
      title: saleTitle,
      description: saleDescription,
      total_amount: totalAmount,
      items,
      notification_url: this.notificationUrl,
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

  private async request<T = unknown>(method: string, url: string, payload?: unknown): Promise<T> {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new HttpException('MP_ACCESS_TOKEN no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;
    const hasBody = typeof payload !== 'undefined';
    const payloadRecord = isRecord(payload) ? payload : undefined;
    const payloadSummary = payloadRecord
      ? {
          total_amount: payloadRecord.total_amount,
          items_length: Array.isArray(payloadRecord.items)
            ? payloadRecord.items.length
            : undefined,
          total_amount_type: typeof payloadRecord.total_amount,
        }
      : undefined;
    this.logger.debug(
      `Mercado Pago request dispatch: ${method} ${url} payload=${payloadSummary ? JSON.stringify(payloadSummary) : 'none'}`,
    );
    const controller = new AbortController();
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);
    const jsonBody = hasBody ? JSON.stringify(payload) : undefined;
    if (hasBody && !jsonBody) {
      throw new HttpException('Payload inválido para Mercado Pago', HttpStatus.BAD_REQUEST);
    }
    if (jsonBody) {
      const parsedBody: unknown = JSON.parse(jsonBody);
      if (isRecord(parsedBody)) {
        const jsonBodySummary = {
          total_amount: parsedBody.total_amount,
          items_length: Array.isArray(parsedBody.items) ? parsedBody.items.length : undefined,
          total_amount_type: typeof parsedBody.total_amount,
        };
        this.logger.debug(
          `Mercado Pago jsonBody summary: ${JSON.stringify(jsonBodySummary)}`,
        );
        if (parsedBody.total_amount === null || typeof parsedBody.total_amount === 'undefined') {
          throw new HttpException(
            'total_amount ausente en el payload para Mercado Pago',
            HttpStatus.BAD_REQUEST,
          );
        }
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
      const response = await fetch(url, {
        method,
        headers,
        body: jsonBody,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        const error: { response?: { status: number; data: string } } = {
          response: { status: response.status, data: text },
        };
        throw error;
      }
      const bodyPreview = this.truncateText(text, 1024);
      const parsed = text ? this.safeJsonParse(text) : null;
      const keyFields = this.extractKeyFields(parsed);
      if (method === 'PUT' && url.includes('/instore/qr/')) {
        this.logger.log(
          `MP instore order OK status=${response.status} body_preview=${bodyPreview} key_fields=${JSON.stringify(
            keyFields,
          )}`,
        );
      } else {
        this.logger.debug(
          `Mercado Pago response OK status=${response.status} body_preview=${bodyPreview}`,
        );
      }
      return (parsed ?? (text as unknown)) as T;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        error.response
      ) {
        const response = error.response as { status: number; data: string };
        this.logger.error(
          `Mercado Pago response error status=${response.status} data=${response.data}`,
        );
        throw new HttpException(
          `Mercado Pago error ${response.status} en ${method} ${url}: ${response.data}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      if (didTimeout) {
        this.logger.error(
          `Mercado Pago timeout after ${this.timeoutMs}ms on ${method} ${url}`,
        );
      }
      if (error instanceof HttpException) {
        throw error;
      }
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'UNKNOWN';
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message)
          : String(error);
      this.logger.error(`Mercado Pago network error code=${errorCode} message=${errorMessage}`);
      throw new HttpException(
        `Mercado Pago network error: ${errorCode} ${errorMessage}`,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private safeJsonParse(text: string): Record<string, unknown> | null {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractKeyFields(payload: Record<string, unknown> | null) {
    if (!payload) {
      return {};
    }
    const keyFields: Record<string, unknown> = {};
    const keys = [
      'id',
      'status',
      'status_detail',
      'external_reference',
      'qr_data',
      'merchant_order_id',
      'collector_id',
    ];
    keys.forEach((key) => {
      if (typeof payload[key] !== 'undefined') {
        keyFields[key] = payload[key];
      }
    });
    return keyFields;
  }

  private truncateText(text: string, maxLength: number) {
    if (!text) {
      return '';
    }
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  private parseNumber(value: unknown, field: string) {
    const parsed = this.toNumber(value);
    if (!Number.isFinite(parsed)) {
      throw new HttpException(`${field} inválido en la venta`, HttpStatus.BAD_REQUEST);
    }
    return parsed;
  }

  private normalizeText(value: unknown, fallback: string) {
    const normalized = String(value ?? '').trim();
    if (normalized) {
      return normalized;
    }
    return fallback.trim() || fallback;
  }

  private ensureNonEmptyText(value: string, field: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new HttpException(`${field} requerido en el payload de Mercado Pago`, HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private toSkuNumber(productId: string | number | null, itemId: string | number) {
    const raw = productId ? String(productId) : `saleitem${itemId}`;
    const sanitized = raw.replace(/[^a-zA-Z0-9]/g, '');
    if (!sanitized) {
      throw new HttpException('sku_number inválido en los items de la venta', HttpStatus.BAD_REQUEST);
    }
    return sanitized;
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

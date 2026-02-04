import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MercadoPagoQueryService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 8000;
  private readonly logger = new Logger(MercadoPagoQueryService.name);

  constructor(private config: ConfigService) {}

  getPayment(paymentId: string) {
    return this.request('GET', `${this.baseUrl}/v1/payments/${paymentId}`);
  }

  getMerchantOrder(merchantOrderId: string) {
    return this.request('GET', `${this.baseUrl}/merchant_orders/${merchantOrderId}`);
  }

  getMerchantOrderByResource(resource: string | null, fallbackId?: string) {
    const resolvedUrl = this.resolveMerchantOrderUrl(resource);
    if (resolvedUrl) {
      return this.request('GET', resolvedUrl);
    }
    if (fallbackId) {
      return this.getMerchantOrder(fallbackId);
    }
    throw new HttpException(
      'Merchant order resource no configurado',
      HttpStatus.BAD_REQUEST,
    );
  }

  searchPaymentsByExternalReference(externalReference: string) {
    const encoded = encodeURIComponent(externalReference);
    return this.request('GET', `${this.baseUrl}/v1/payments/search?external_reference=${encoded}`);
  }

  private async request<T = unknown>(method: string, url: string): Promise<T> {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new HttpException('MP_ACCESS_TOKEN no configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    this.logger.debug(`Mercado Pago query: ${method} ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.error(`Mercado Pago query error ${response.status}: ${text}`);
        throw new HttpException(
          `Mercado Pago error ${response.status} en ${method} ${url}: ${text}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return (text ? JSON.parse(text) : {}) as T;
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

  private resolveMerchantOrderUrl(resource: string | null) {
    if (!resource) {
      return null;
    }
    const trimmed = resource.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const url = new URL(trimmed);
      if (this.isAllowedMerchantOrderHost(url.hostname) && url.pathname.includes('/merchant_orders/')) {
        return url.toString();
      }
    } catch {
      // Non URL, fallthrough to parse id.
    }
    const match = trimmed.match(/merchant_orders\/(\d+)/);
    if (match?.[1]) {
      return `${this.baseUrl}/merchant_orders/${match[1]}`;
    }
    return null;
  }

  private isAllowedMerchantOrderHost(hostname: string) {
    return hostname.endsWith('mercadopago.com') || hostname.endsWith('mercadolibre.com');
  }
}

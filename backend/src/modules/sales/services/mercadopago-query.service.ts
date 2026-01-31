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
}

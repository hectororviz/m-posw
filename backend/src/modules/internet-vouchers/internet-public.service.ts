import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { PrismaService } from '../common/prisma.service';

export type PublicInternetReason =
  | 'AVAILABLE'
  | 'INTERNET_DISABLED'
  | 'MP_NOT_LINKED'
  | 'NO_PLANS';

export interface PublicInternetStatus {
  available: boolean;
  reason: PublicInternetReason;
  storeName: string;
  clubName: string;
  logoUrl: string | null;
}

interface MpPreferenceResponse {
  id?: string | number;
  init_point?: string;
  sandbox_init_point?: string;
}

const CHECKOUT_TIMEOUT_MS = 15000;

@Injectable()
export class InternetPublicService {
  private readonly logger = new Logger(InternetPublicService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mpConfig: MercadoPagoConfigService,
  ) {}

  async getStatus(): Promise<PublicInternetStatus> {
    const setting = await this.prisma.setting.findFirst();
    const storeName = setting?.storeName ?? 'm-POSw';
    const clubName = setting?.clubName ?? '';
    const logoUrl = setting?.logoUrl ?? null;

    if (!setting?.enableInternetModule) {
      return { available: false, reason: 'INTERNET_DISABLED', storeName, clubName, logoUrl };
    }
    if (!setting.mpLinked || !setting.mpAccessToken) {
      return { available: false, reason: 'MP_NOT_LINKED', storeName, clubName, logoUrl };
    }
    const activePlans = await this.prisma.internetPlan.count({ where: { active: true } });
    if (activePlans === 0) {
      return { available: false, reason: 'NO_PLANS', storeName, clubName, logoUrl };
    }
    return { available: true, reason: 'AVAILABLE', storeName, clubName, logoUrl };
  }

  private async assertAvailable() {
    const status = await this.getStatus();
    if (!status.available) {
      throw new ServiceUnavailableException({ code: status.reason, message: this.reasonMessage(status.reason) });
    }
    return status;
  }

  private reasonMessage(reason: PublicInternetReason): string {
    switch (reason) {
      case 'INTERNET_DISABLED':
        return 'La venta de internet no está habilitada';
      case 'MP_NOT_LINKED':
        return 'El pago online no está disponible en este momento';
      case 'NO_PLANS':
        return 'No hay planes disponibles en este momento';
      default:
        return 'Servicio no disponible';
    }
  }

  async listPlans() {
    await this.assertAvailable();
    const plans = await this.prisma.internetPlan.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        downloadBandwidth: true,
        uploadBandwidth: true,
      },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      duration: p.duration,
      price: Number(p.price),
      downloadBandwidth: p.downloadBandwidth,
      uploadBandwidth: p.uploadBandwidth,
    }));
  }

  async createCheckout(planId: string, returnBaseUrl?: string) {
    await this.assertAvailable();

    const plan = await this.prisma.internetPlan.findFirst({
      where: { id: planId, active: true },
      include: { product: true },
    });
    if (!plan) throw new NotFoundException('Plan no disponible');
    if (!plan.productId || !plan.product) {
      throw new BadRequestException('El plan no tiene producto asociado');
    }
    const price = Number(plan.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('El plan no tiene un precio válido para venta online');
    }

    const seller =
      (await this.prisma.user.findFirst({
        where: { active: true, role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
      })) ?? (await this.prisma.user.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } }));
    if (!seller) {
      throw new ServiceUnavailableException('No hay usuario vendedor configurado');
    }

    const sale = await this.prisma.sale.create({
      data: {
        userId: seller.id,
        total: price,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'MP_QR',
        statusUpdatedAt: new Date(),
        paymentStartedAt: new Date(),
        items: {
          create: [{ productId: plan.productId, quantity: 1, subtotal: price }],
        },
      },
    });
    const externalReference = `sale-${sale.id}`;
    await this.prisma.sale.update({
      where: { id: sale.id },
      data: { mpExternalReference: externalReference },
    });

    const baseUrl = this.resolveReturnBase(returnBaseUrl);
    const returnUrl = `${baseUrl}/internet/retorno?orderId=${sale.id}`;
    const preference = await this.createPreference({
      title: `Internet ${plan.name}`,
      unitPrice: price,
      externalReference,
      successUrl: returnUrl,
      failureUrl: returnUrl,
      pendingUrl: returnUrl,
    });

    await this.prisma.sale.update({
      where: { id: sale.id },
      data: { mpOrderId: String(preference.id ?? ''), mpStatus: 'CHECKOUT_PRO' },
    });

    this.logger.log(`Checkout público creado sale=${sale.id} plan=${plan.name} pref=${preference.id}`);
    return { orderId: sale.id, initPoint: preference.init_point };
  }

  async getOrder(orderId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { include: { internetPlan: true } } } },
        vouchers: { include: { plan: true } },
      },
    });
    if (!sale) throw new NotFoundException('Orden no encontrada');

    const isInternetSale =
      sale.vouchers.length > 0 ||
      sale.items.some((i) => i.product?.internetPlan);
    if (!isInternetSale) throw new NotFoundException('Orden no encontrada');

    const item = sale.items[0];
    const planName = sale.vouchers[0]?.plan.name ?? item?.product?.internetPlan?.name ?? item?.product?.name ?? 'Internet';
    const duration = sale.vouchers[0]?.plan.duration ?? item?.product?.internetPlan?.duration ?? null;
    const voucher = sale.vouchers.find((v) => v.active) ?? sale.vouchers[0] ?? null;

    return {
      orderId: sale.id,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      planName,
      price: Number(sale.total),
      duration,
      pin: sale.paymentStatus === 'APPROVED' && sale.status === 'APPROVED' ? voucher?.pin ?? null : null,
      wifi: {
        ssid: this.config.get<string>('WIFI_SSID') ?? null,
        portalUrl: this.config.get<string>('WIFI_PORTAL_URL') ?? null,
        helpText: this.config.get<string>('WIFI_HELP_TEXT') ?? null,
      },
    };
  }

  private resolveReturnBase(input?: string): string {
    const fallback = this.defaultPublicBase();
    if (!input) return fallback;
    try {
      const url = new URL(input);
      const host = url.hostname.toLowerCase();
      const ok =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.mposw.com.ar') ||
        host === 'mposw.com.ar';
      if ((url.protocol === 'https:' || url.protocol === 'http:') && ok) {
        return url.origin;
      }
    } catch {
      // ignorar y usar fallback
    }
    return fallback;
  }

  private defaultPublicBase(): string {
    const subdomain = this.config.get<string>('INSTANCE_SUBDOMAIN');
    if (subdomain) return `https://${subdomain}.mposw.com.ar`;
    const cors = this.config.get<string>('CORS_ORIGIN');
    if (cors) {
      try {
        return new URL(cors).origin;
      } catch {
        // ignorar
      }
    }
    return 'https://pos.csdsoler.com.ar';
  }

  private getNotificationUrl(): string {
    const explicit = this.config.get<string>('MP_WEBHOOK_URL');
    if (explicit) return explicit;
    const subdomain = this.config.get<string>('INSTANCE_SUBDOMAIN');
    if (subdomain) return `https://${subdomain}.mposw.com.ar/api/webhooks/mercadopago`;
    return 'https://pos.csdsoler.com.ar/api/webhooks/mercadopago';
  }

  private async createPreference(input: {
    title: string;
    unitPrice: number;
    externalReference: string;
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
  }): Promise<{ id: string; init_point: string }> {
    const token = await this.mpConfig.getAccessToken();
    if (!token) {
      throw new HttpException('Pago online no configurado', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const setting = await this.prisma.setting.findFirst({ select: { storeName: true } });
    const descriptor = (setting?.storeName ?? 'MPOSW').slice(0, 18);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const body = {
      items: [
        {
          title: input.title.slice(0, 200),
          quantity: 1,
          unit_price: Math.round(input.unitPrice * 100) / 100,
          currency_id: this.config.get<string>('MP_CURRENCY_ID') || 'ARS',
        },
      ],
      external_reference: input.externalReference,
      back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.pendingUrl },
      auto_return: 'approved',
      notification_url: this.getNotificationUrl(),
      statement_descriptor: descriptor,
      expires: true,
      expiration_date_to: expiresAt,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const integrator = process.env.MP_INTEGRATOR_ID;
      if (integrator) headers['X-Integrator-Id'] = integrator;
      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let data: MpPreferenceResponse = {};
      try {
        data = text ? (JSON.parse(text) as MpPreferenceResponse) : {};
      } catch {
        throw new HttpException('Respuesta inválida de Mercado Pago', HttpStatus.BAD_GATEWAY);
      }
      if (!res.ok || !data.init_point) {
        this.logger.error(`MP preference failed HTTP ${res.status}: ${text.slice(0, 500)}`);
        throw new HttpException('No se pudo generar el link de pago', HttpStatus.BAD_GATEWAY);
      }
      return { id: String(data.id ?? ''), init_point: data.init_point };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`MP preference network error: ${error}`);
      throw new HttpException('No se pudo comunicar con Mercado Pago', HttpStatus.BAD_GATEWAY);
    } finally {
      clearTimeout(timeout);
    }
  }
}

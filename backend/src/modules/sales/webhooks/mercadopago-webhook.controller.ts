import { Body, Controller, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoInstoreService } from '../services/mercadopago-instore.service';

type MpPayment = {
  external_reference?: string | null;
  status?: string | null;
  date_approved?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getStringIdFromBody = (body: unknown): string | null => {
  if (!isRecord(body)) {
    return null;
  }

  const data = body['data'];
  if (!isRecord(data)) {
    return null;
  }

  const id = data['id'];
  if (typeof id === 'string') {
    return id;
  }
  if (typeof id === 'number') {
    return String(id);
  }
  if (isRecord(id) && typeof id['toString'] === 'function') {
    return String(id);
  }

  return null;
};

const isMpPayment = (value: unknown): value is MpPayment => {
  if (!isRecord(value)) {
    return false;
  }

  const props: Array<keyof MpPayment> = ['external_reference', 'status', 'date_approved'];
  return props.every((prop) => {
    const propValue = value[prop];
    return propValue === undefined || propValue === null || typeof propValue === 'string';
  });
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }
  if (isRecord(value)) {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || typeof entry === 'function') {
        continue;
      }
      result[key] = toJsonValue(entry);
    }
    return result;
  }
  return String(value);
};

@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private mpService: MercadoPagoInstoreService,
  ) {}

  @Post('mercadopago')
  async handleWebhook(@Body() body: Record<string, unknown>, @Query('secret') secret?: string) {
    const expectedSecret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Webhook inválido');
    }

    const paymentId =
      getStringIdFromBody(body) || body?.payment_id?.toString?.() || body?.id?.toString?.();

    if (!paymentId) {
      return { received: true };
    }

    const payment = await this.mpService.getPayment(paymentId);
    const parsedPayment = isMpPayment(payment) ? payment : null;
    const externalReference = parsedPayment?.external_reference ?? null;
    if (!externalReference) {
      return { received: true };
    }

    const sale = await this.prisma.sale.findUnique({ where: { id: externalReference } });
    if (!sale) {
      return { received: true };
    }

    const status = parsedPayment?.status ?? 'unknown';
    const approvedAt = parsedPayment?.date_approved ? new Date(parsedPayment.date_approved) : null;

    await this.prisma.mercadoPagoPayment.create({
      data: {
        saleId: sale.id,
        paymentId: paymentId.toString(),
        status,
        approvedAt,
        payload: toJsonValue(payment),
      },
    });

    if (status === 'approved' && sale.status !== SaleStatus.PAID) {
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.PAID,
          statusUpdatedAt: new Date(),
          paidAt: approvedAt ?? new Date(),
        },
      });
    }

    return { received: true };
  }
}

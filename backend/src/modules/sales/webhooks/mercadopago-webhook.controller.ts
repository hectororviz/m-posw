import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from '../services/mercadopago-query.service';
import { SalesGateway } from '../websockets/sales.gateway';

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

const parseSignatureHeader = (signature: string) => {
  const parts = signature.split(',').map((part) => part.trim());
  const result: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (!key || rest.length === 0) {
      continue;
    }
    result[key.trim()] = rest.join('=').trim();
  }
  return result;
};

const parseResourceIdFromUrl = (resource: string) => {
  const trimmed = resource.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/\/([^/?#]+)$/);
  return match ? match[1] : null;
};

const extractExternalReference = (payload: Record<string, unknown> | null) => {
  const externalReference = payload?.external_reference;
  return typeof externalReference === 'string' ? externalReference : null;
};

const normalizeSaleId = (externalReference: string) => {
  const trimmed = externalReference.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('sale-') ? trimmed.slice('sale-'.length) : trimmed;
};

const extractMerchantOrderId = (payload: Record<string, unknown> | null) => {
  const order = payload?.order;
  if (isRecord(order)) {
    const orderId = order.id;
    if (typeof orderId === 'string') {
      return orderId;
    }
    if (typeof orderId === 'number') {
      return String(orderId);
    }
  }
  const merchantOrderId = payload?.merchant_order_id;
  if (typeof merchantOrderId === 'string') {
    return merchantOrderId;
  }
  if (typeof merchantOrderId === 'number') {
    return String(merchantOrderId);
  }
  return null;
};

const mapPaymentStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'approved') {
    return PaymentStatus.APPROVED;
  }
  if (normalized === 'rejected' || normalized === 'cancelled') {
    return PaymentStatus.REJECTED;
  }
  if (normalized === 'pending' || normalized === 'in_process') {
    return PaymentStatus.PENDING;
  }
  return null;
};

const mapMerchantOrderStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'closed') {
    return PaymentStatus.APPROVED;
  }
  if (normalized === 'expired') {
    return PaymentStatus.EXPIRED;
  }
  if (normalized === 'opened') {
    return PaymentStatus.PENDING;
  }
  return null;
};

const mapSaleStatus = (status: PaymentStatus | null) => {
  if (!status) {
    return null;
  }
  if (status === PaymentStatus.APPROVED) {
    return SaleStatus.APPROVED;
  }
  if (status === PaymentStatus.REJECTED) {
    return SaleStatus.REJECTED;
  }
  if (status === PaymentStatus.EXPIRED) {
    return SaleStatus.EXPIRED;
  }
  return SaleStatus.PENDING;
};

@Controller('webhooks')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private mpQueryService: MercadoPagoQueryService,
    private salesGateway: SalesGateway,
  ) {}

  @Post('mercadopago')
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, string>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(
      `WEBHOOK_RECEIVED ${JSON.stringify({
        method: request.method,
        url: request.originalUrl ?? request.url,
        query,
        headers,
        body,
      })}`,
    );

    const signatureHeader = this.getHeader(headers, 'x-signature');
    const requestId = this.getHeader(headers, 'x-request-id');
    const resourceId =
      (body?.type === 'payment' && getStringIdFromBody(body)) ||
      (query?.topic === 'merchant_order' && query?.id) ||
      (typeof body?.resource === 'string' ? parseResourceIdFromUrl(body.resource) : null) ||
      getStringIdFromBody(body);

    this.verifySignature(signatureHeader, requestId, resourceId);

    response.status(200).json({ ok: true });

    try {
      await this.processWebhook(body, query, resourceId);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
    }
  }

  private async processWebhook(
    body: Record<string, unknown>,
    query: Record<string, string>,
    resourceId: string | null | undefined,
  ) {
    const topic = body?.type?.toString?.() || query?.topic || 'unknown';
    const eventResourceId = resourceId ?? 'unknown';
    const shouldProcess = await this.ensureIdempotency(topic, eventResourceId);
    if (!shouldProcess) {
      return;
    }

    const resourceUrl = typeof body?.resource === 'string' ? body.resource : '';
    const isMerchantOrder =
      query?.topic === 'merchant_order' || resourceUrl.includes('/merchant_orders/');

    const mpData = isMerchantOrder
      ? await this.mpQueryService.getMerchantOrder(eventResourceId)
      : await this.mpQueryService.getPayment(eventResourceId);

    const mpPayload = isRecord(mpData) ? mpData : null;
    const externalReference = extractExternalReference(mpPayload);
    const saleIdFromReference = externalReference ? normalizeSaleId(externalReference) : null;

    const sale =
      (saleIdFromReference
        ? await this.prisma.sale.findUnique({ where: { id: saleIdFromReference } })
        : null) ||
      (eventResourceId
        ? await this.prisma.sale.findFirst({
            where: isMerchantOrder
              ? { mpMerchantOrderId: eventResourceId }
              : { mpPaymentId: eventResourceId },
          })
        : null);

    if (!sale) {
      return;
    }

    const mpStatus = typeof mpPayload?.status === 'string' ? mpPayload.status : null;
    const mpStatusDetail =
      typeof mpPayload?.status_detail === 'string' ? mpPayload.status_detail : null;
    const approvedAt =
      typeof mpPayload?.date_approved === 'string' ? new Date(mpPayload.date_approved) : null;
    const merchantOrderIdFromPayment = extractMerchantOrderId(mpPayload);
    const nextPaymentStatus = isMerchantOrder
      ? mapMerchantOrderStatus(mpStatus)
      : mapPaymentStatus(mpStatus);
    const nextSaleStatus = mapSaleStatus(nextPaymentStatus);
    const updatedSale = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        paymentStatus: nextPaymentStatus ?? sale.paymentStatus,
        status:
          nextSaleStatus && sale.status !== SaleStatus.APPROVED ? nextSaleStatus : sale.status,
        statusUpdatedAt:
          nextSaleStatus && sale.status !== SaleStatus.APPROVED ? new Date() : sale.statusUpdatedAt,
        paidAt:
          nextPaymentStatus === PaymentStatus.APPROVED ? approvedAt ?? new Date() : sale.paidAt,
        mpPaymentId: isMerchantOrder ? sale.mpPaymentId : eventResourceId,
        mpMerchantOrderId: isMerchantOrder
          ? eventResourceId
          : merchantOrderIdFromPayment ?? sale.mpMerchantOrderId,
        mpStatus,
        mpStatusDetail,
        mpRaw: toJsonValue(mpPayload ?? mpData),
      },
    });

    this.salesGateway.notifyPaymentStatusChanged({
      saleId: updatedSale.id,
      paymentStatus: updatedSale.paymentStatus,
      mpStatus: updatedSale.mpStatus,
      mpStatusDetail: updatedSale.mpStatusDetail,
    });

  }

  private verifySignature(
    signatureHeader: string | undefined,
    requestId: string | undefined,
    resourceId: string | null | undefined,
  ) {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret || !signatureHeader || !requestId || !resourceId) {
      this.logger.warn('Webhook de Mercado Pago sin firma válida o headers incompletos');
      throw new UnauthorizedException('Webhook inválido');
    }

    const parsed = parseSignatureHeader(signatureHeader);
    const ts = parsed['ts'];
    const v1 = parsed['v1'];
    if (!ts || !v1) {
      this.logger.warn('Webhook de Mercado Pago con firma incompleta');
      throw new UnauthorizedException('Webhook inválido');
    }

    const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    const digestBuffer = Buffer.from(digest, 'hex');
    const signatureBuffer = Buffer.from(v1, 'hex');
    if (digestBuffer.length !== signatureBuffer.length) {
      this.logger.warn('Webhook de Mercado Pago con firma inválida');
      throw new UnauthorizedException('Webhook inválido');
    }
    if (!timingSafeEqual(digestBuffer, signatureBuffer)) {
      this.logger.warn('Webhook de Mercado Pago con firma inválida');
      throw new UnauthorizedException('Webhook inválido');
    }
  }

  private async ensureIdempotency(topic: string, resourceId: string) {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          provider: 'MP',
          topic,
          resourceId,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    if (typeof value === 'string') {
      return value;
    }
    return undefined;
  }
}

import {
  Body,
  Controller,
  Headers,
  HttpException,
  Logger,
  Post,
  Query,
  Req,
  Res,
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
  const segments = trimmed.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    return null;
  }
  return /^\d+$/.test(lastSegment) ? lastSegment : null;
};

const normalizeResourceId = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const normalizeNumericResourceId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return /^\d+$/.test(trimmed) ? trimmed : null;
};

export const getResourceId = (req: {
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}) => {
  const query = req.query ?? {};
  const body = req.body ?? {};
  const dataIdFromQuery = query['data.id'];
  if (dataIdFromQuery) {
    return normalizeResourceId(dataIdFromQuery);
  }
  const dataIdFromBody = normalizeResourceId(body?.data && isRecord(body.data) ? body.data.id : null);
  if (dataIdFromBody) {
    return dataIdFromBody;
  }
  if (query.id) {
    return normalizeResourceId(query.id);
  }
  if (typeof body?.resource === 'string') {
    const normalizedResource = normalizeNumericResourceId(body.resource);
    if (normalizedResource) {
      return normalizedResource;
    }
    return parseResourceIdFromUrl(body.resource);
  }
  return null;
};

const parseBooleanEnv = (value: string | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
};

const extractLiveMode = (body: Record<string, unknown> | undefined) => {
  if (!body) {
    return null;
  }
  if (typeof body.live_mode === 'boolean') {
    return body.live_mode;
  }
  if (isRecord(body.data) && typeof body.data.live_mode === 'boolean') {
    return body.data.live_mode;
  }
  return null;
};

const resolveHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
) => {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

export const verifySignature = (
  req: { headers: Record<string, string | string[] | undefined> },
  resourceId: string,
  secret: string,
) => {
  const signatureHeader = resolveHeaderValue(req.headers, 'x-signature');
  const requestId = resolveHeaderValue(req.headers, 'x-request-id');
  if (!signatureHeader || !requestId) {
    return {
      isValid: false,
      reason: 'missing_headers',
    };
  }
  const parsed = parseSignatureHeader(signatureHeader);
  const ts = parsed['ts'];
  const v1 = parsed['v1'];
  if (!ts || !v1) {
    return {
      isValid: false,
      reason: 'missing_signature_parts',
      requestId,
      ts,
      v1,
    };
  }
  const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
  const digest = createHmac('sha256', secret).update(manifest).digest('hex');
  const digestBuffer = Buffer.from(digest, 'hex');
  const signatureBuffer = Buffer.from(v1, 'hex');
  if (digestBuffer.length !== signatureBuffer.length) {
    return {
      isValid: false,
      reason: 'length_mismatch',
      requestId,
      ts,
      v1,
      manifest,
      digest,
    };
  }
  if (!timingSafeEqual(digestBuffer, signatureBuffer)) {
    return {
      isValid: false,
      reason: 'digest_mismatch',
      requestId,
      ts,
      v1,
      manifest,
      digest,
    };
  }
  return {
    isValid: true,
    requestId,
    ts,
    v1,
    manifest,
    digest,
  };
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

    const resourceId = getResourceId({ query, body });
    if (!resourceId) {
      this.logger.warn('Webhook de Mercado Pago con headers incompletos');
      response.status(400).json({ ok: false, error: 'headers incompletos' });
      return;
    }
    const signatureResult = this.verifySignature(
      { headers, body },
      resourceId,
    );
    if (!signatureResult.isValid) {
      if (signatureResult.acceptedInvalid) {
        response.status(200).json({ ok: true, signatureAccepted: true });
      } else {
        response.status(401).json({ ok: false, error: 'invalid signature' });
        return;
      }
    } else {
      response.status(200).json({ ok: true });
    }

    try {
      await this.processWebhook(body, query, resourceId, signatureResult.requestId);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
    }
  }

  private async processWebhook(
    body: Record<string, unknown>,
    query: Record<string, string>,
    resourceId: string | null | undefined,
    requestId?: string,
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

    let mpData: unknown;
    try {
      mpData = isMerchantOrder
        ? await this.mpQueryService.getMerchantOrder(eventResourceId)
        : await this.mpQueryService.getPayment(eventResourceId);
    } catch (error) {
      if (!isMerchantOrder && this.isPaymentNotFoundError(error)) {
        this.logger.warn(
          `WEBHOOK_IGNORED_PAYMENT_NOT_FOUND paymentId=${eventResourceId} requestId=${requestId ?? 'unknown'}`,
        );
        return;
      }
      throw error;
    }

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
    req: { headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> },
    resourceId: string,
  ) {
    const debugSignature = this.config.get<string>('DEBUG_WEBHOOK_SIGNATURE') === 'true';
    const acceptInvalid =
      debugSignature &&
      this.config.get<string>('MP_WEBHOOK_ACCEPT_INVALID_SIGNATURE') === 'true';
    const liveMode =
      extractLiveMode(req.body) ?? parseBooleanEnv(this.config.get<string>('MP_WEBHOOK_LIVE_MODE'));
    const liveSecret = this.config.get<string>('MP_WEBHOOK_SECRET_LIVE');
    const testSecret = this.config.get<string>('MP_WEBHOOK_SECRET_TEST');

    let selectedSecret: string | undefined;
    let selectedMode: string | null = null;
    if (liveMode === true) {
      selectedSecret = liveSecret;
      selectedMode = 'live';
    } else if (liveMode === false) {
      selectedSecret = testSecret;
      selectedMode = 'test';
    } else if (liveSecret && !testSecret) {
      selectedSecret = liveSecret;
      selectedMode = 'live';
    } else if (testSecret && !liveSecret) {
      selectedSecret = testSecret;
      selectedMode = 'test';
    }

    this.logger.log(
      `WEBHOOK_SIGNATURE_SECRET mode=${selectedMode ?? 'unknown'} length=${
        selectedSecret?.length ?? 0
      }`,
    );

    if (!selectedSecret) {
      this.logger.warn('Webhook de Mercado Pago sin firma válida o headers incompletos');
      return { isValid: false, acceptedInvalid: acceptInvalid };
    }

    const result = verifySignature(
      { headers: req.headers },
      resourceId,
      selectedSecret,
    );

    if (!result.isValid) {
      this.logger.warn('Webhook de Mercado Pago con firma inválida');
      if (debugSignature) {
        this.logger.log(
          `WEBHOOK_SIGNATURE_INVALID ${JSON.stringify({
            resourceId,
            requestId: result.requestId ?? resolveHeaderValue(req.headers, 'x-request-id') ?? 'unknown',
            ts: result.ts ?? 'unknown',
            manifest: result.manifest ?? null,
            receivedSignature: result.v1 ?? null,
            calculatedHash: result.digest ?? null,
          })}`,
        );
      }
      return { isValid: false, acceptedInvalid: acceptInvalid, requestId: result.requestId };
    }

    return { isValid: true, acceptedInvalid: false, requestId: result.requestId };
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

  private isPaymentNotFoundError(error: unknown) {
    if (!(error instanceof HttpException)) {
      return false;
    }
    const response = error.getResponse();
    const responseText =
      typeof response === 'string' ? response : JSON.stringify(response);
    return (
      responseText.includes('Mercado Pago error 404') &&
      responseText.includes('Payment not found')
    );
  }
}

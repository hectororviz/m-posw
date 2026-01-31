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
import { createHash, createHmac, timingSafeEqual } from 'crypto';
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

export const parseSignatureHeader = (signature: string) => {
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

const parsePaymentIdFromUrl = (resource: string) => {
  const trimmed = resource.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/\/payments\/(\d+)(?:\?|$)/);
  return match?.[1] ?? null;
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
  if (query.id && query.topic === 'payment') {
    return normalizeResourceId(query.id);
  }
  const dataIdFromBody = normalizeResourceId(body?.data && isRecord(body.data) ? body.data.id : null);
  if (dataIdFromBody) {
    return dataIdFromBody;
  }
  if (typeof body?.resource === 'string') {
    return parsePaymentIdFromUrl(body.resource);
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
  const manifestHash = createHash('sha256').update(manifest).digest('hex');
  if (!/^[0-9a-f]+$/i.test(v1) || v1.length % 2 !== 0) {
    return {
      isValid: false,
      reason: 'invalid_signature_format',
      requestId,
      ts,
      v1,
      manifest,
      digest,
      manifestHash,
    };
  }
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
      manifestHash,
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
      manifestHash,
    };
  }
  return {
    isValid: true,
    requestId,
    ts,
    v1,
    manifest,
    digest,
    manifestHash,
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
    return PaymentStatus.OK;
  }
  if (normalized === 'rejected' || normalized === 'cancelled') {
    return PaymentStatus.FAILED;
  }
  if (normalized === 'pending' || normalized === 'in_process') {
    return PaymentStatus.PENDING;
  }
  return null;
};

const mapSaleStatus = (status: PaymentStatus | null) => {
  if (!status) {
    return null;
  }
  if (status === PaymentStatus.OK) {
    return SaleStatus.APPROVED;
  }
  if (status === PaymentStatus.FAILED) {
    return SaleStatus.REJECTED;
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
      this.logger.warn('WEBHOOK_MP_PAYMENT_ID_MISSING');
      response.status(200).json({ ok: true });
      return;
    }
    const signatureResult = this.verifySignature({ headers, body }, resourceId);
    if (!signatureResult.isValid) {
      response.status(200).json({ ok: true });
      return;
    }

    response.status(200).json({ ok: true });
    void this.processWebhook(body, query, resourceId, signatureResult.requestId).catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
    });
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

    let mpData: unknown;
    try {
      mpData = await this.mpQueryService.getPayment(eventResourceId);
    } catch (error) {
      if (this.isPaymentNotFoundError(error)) {
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
            where: { mpPaymentId: eventResourceId },
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
    const nextPaymentStatus = mapPaymentStatus(mpStatus);
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
          nextPaymentStatus === PaymentStatus.OK ? approvedAt ?? new Date() : sale.paidAt,
        mpPaymentId: eventResourceId,
        mpMerchantOrderId: merchantOrderIdFromPayment ?? sale.mpMerchantOrderId,
        mpStatus,
        mpStatusDetail,
        updatedAt: new Date(),
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
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');

    if (!secret) {
      this.logger.error('WEBHOOK_MP_SECRET_MISSING');
      return { isValid: false };
    }

    const signatureHeader = resolveHeaderValue(req.headers, 'x-signature');
    if (!signatureHeader) {
      this.logger.warn('WEBHOOK_MP_SIGNATURE_HEADER_MISSING');
      return { isValid: false };
    }

    const result = verifySignature({ headers: req.headers }, resourceId, secret);

    const receivedSignatureSnippet = result.v1?.slice(0, 8) ?? 'unknown';
    const calculatedHashSnippet = result.digest?.slice(0, 8) ?? 'unknown';
    const manifestHash = result.manifestHash ?? null;
    this.logger.debug(
      `WEBHOOK_MP_SIGNATURE_DEBUG received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} manifestSha256=${manifestHash ?? 'unknown'}`,
    );

    if (!result.isValid) {
      this.logger.warn('WEBHOOK_MP_SIGNATURE_INVALID');
      return { isValid: false, requestId: result.requestId };
    }

    return { isValid: true, requestId: result.requestId };
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

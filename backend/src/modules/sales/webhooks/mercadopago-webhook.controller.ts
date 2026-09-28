import { Body, Controller, Headers, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { MercadoPagoWebhookProcessorService } from '../services/mercadopago-webhook-processor.service';
import { MercadoPagoQueryService } from '../services/mercadopago-query.service';
import {
  extractExternalReference,
  getManifestId,
  getResourceId,
  isRecord,
  mapMpPaymentToPaymentStatus,
  verifySignature,
} from './mercadopago-webhook.utils';
import { PaymentStatus } from '@prisma/client';

@SkipThrottle()
@Controller('webhooks')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);
  private readonly feedAttempts = new Map<string, number[]>();
  private static readonly FEED_WINDOW_MS = 60 * 1000;
  private static readonly FEED_LIMIT_PER_MIN = 30;
  private static readonly FEED_MAX_TRACKED_IPS = 10000;

  constructor(
    private config: ConfigService,
    private processor: MercadoPagoWebhookProcessorService,
    private mpQuery: MercadoPagoQueryService,
  ) {}

  @Post('mercadopago')
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, string>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resourceId = getResourceId({ query, body });
    const topic =
      (typeof body?.topic === 'string' && body.topic) ||
      (typeof body?.type === 'string' && body.type) ||
      query?.topic ||
      query?.type ||
      'unknown';
    const requestIdHeader = Array.isArray(headers['x-request-id'])
      ? headers['x-request-id'][0]
      : headers['x-request-id'];
    this.logger.log(
      `WEBHOOK_RECEIVED method=${request.method} url=${request.originalUrl ?? request.url} topic=${topic} resourceId=${resourceId ?? 'missing'} requestId=${requestIdHeader ?? 'missing'}`,
    );
    if (this.isDumpEnabled()) {
      this.logger.warn(
        `WEBHOOK_DUMP url=${request.originalUrl ?? request.url} query=${JSON.stringify(query)} headers=${JSON.stringify(this.pickDumpHeaders(headers))} body=${JSON.stringify(body)?.slice(0, 2000)}`,
      );
    }

    if (!resourceId) {
      this.logger.warn('WEBHOOK_MP_PAYMENT_ID_MISSING');
      response.status(200).json({ ok: true });
      return;
    }

    const manifestId = getManifestId({ topic, body, query });
    const signatureResult = this.verifySignature({ headers, body }, manifestId, resourceId, topic);
    let requestId = signatureResult.requestId;
    if (!signatureResult.isValid && signatureResult.shouldReject) {
      if (!this.allowFeedAttempt(request)) {
        this.logger.warn(
          `WEBHOOK_FEED_THROTTLED topic=${topic} resourceId=${resourceId} requestId=${requestIdHeader ?? 'missing'}`,
        );
        response.status(401).json({ ok: false });
        return;
      }
      if (await this.verifyFeedViaMpApi({ topic, body, query, resourceId })) {
        requestId = requestId ?? requestIdHeader ?? undefined;
      } else {
        response.status(401).json({ ok: false });
        return;
      }
    }

    response.status(200).json({ ok: true });
    setImmediate(() => {
      void this.processor
        .processWebhook({
          body,
          query,
          resourceId,
          requestId,
          topic,
        })
        .catch((error) => {
          const message = error instanceof Error ? error.stack ?? error.message : String(error);
          this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
        });
    });
  }

  private allowFeedAttempt(request: Request): boolean {
    const forwarded = request.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]
        : undefined;
    const ip = (firstForwarded ?? request?.ip ?? request?.socket?.remoteAddress ?? 'unknown').trim();
    const now = Date.now();
    const windowStart = now - MercadoPagoWebhookController.FEED_WINDOW_MS;
    let hits = this.feedAttempts.get(ip) ?? [];
    hits = hits.filter((at) => at > windowStart);
    if (hits.length >= MercadoPagoWebhookController.FEED_LIMIT_PER_MIN) {
      this.feedAttempts.set(ip, hits);
      return false;
    }
    hits.push(now);
    if (this.feedAttempts.size >= MercadoPagoWebhookController.FEED_MAX_TRACKED_IPS && !this.feedAttempts.has(ip)) {
      const oldest = this.feedAttempts.keys().next();
      if (!oldest.done) {
        this.feedAttempts.delete(oldest.value);
      }
    }
    this.feedAttempts.set(ip, hits);
    return true;
  }

  private async verifyFeedViaMpApi(input: {
    topic: string;
    body: Record<string, unknown>;
    query: Record<string, string>;
    resourceId: string;
  }): Promise<boolean> {
    const queryDataId = input.query?.['data.id'];
    const hasQueryDataId = typeof queryDataId === 'string' && queryDataId.trim() !== '';
    const bodyData = isRecord(input.body?.data) ? input.body.data : null;
    const bodyDataId = bodyData ? (bodyData as Record<string, unknown>).id : null;
    const hasBodyDataId =
      (typeof bodyDataId === 'string' && bodyDataId.trim() !== '') ||
      typeof bodyDataId === 'number';
    if (hasQueryDataId || hasBodyDataId) {
      return false;
    }
    if (input.topic !== 'payment' && input.topic !== 'merchant_order') {
      return false;
    }
    if (!/^\d+$/.test(input.resourceId)) {
      return false;
    }
    try {
      if (input.topic === 'payment') {
        const payment = await this.mpQuery.getPayment(input.resourceId);
        if (!isRecord(payment)) {
          return false;
        }
        const status = typeof payment.status === 'string' ? payment.status : null;
        const detail = typeof payment.status_detail === 'string' ? payment.status_detail : null;
        if (mapMpPaymentToPaymentStatus(status, detail) !== PaymentStatus.APPROVED) {
          this.logger.log(
            `WEBHOOK_FEED_NOT_APPROVED topic=payment resourceId=${input.resourceId}`,
          );
          return false;
        }
        const ref = extractExternalReference(payment);
        if (!ref || (!ref.startsWith('sale-') && !ref.startsWith('ticket-'))) {
          this.logger.warn(
            `WEBHOOK_FEED_REF_MISMATCH topic=payment resourceId=${input.resourceId}`,
          );
          return false;
        }
        this.logger.log(
          `WEBHOOK_FEED_VERIFIED_VIA_API topic=payment resourceId=${input.resourceId} ref=${ref}`,
        );
        return true;
      }
      const resource = typeof input.body?.resource === 'string' ? input.body.resource : null;
      const order = await this.mpQuery.getMerchantOrderByResource(resource, input.resourceId);
      if (!isRecord(order)) {
        return false;
      }
      const ref = extractExternalReference(order);
      if (!ref || (!ref.startsWith('sale-') && !ref.startsWith('ticket-'))) {
        this.logger.warn(
          `WEBHOOK_FEED_REF_MISMATCH topic=merchant_order resourceId=${input.resourceId}`,
        );
        return false;
      }
      const rawPayments = (order as Record<string, unknown>).payments;
      const payments = Array.isArray(rawPayments) ? rawPayments.filter(isRecord) : [];
      const approved = payments.some(
        (payment) =>
          mapMpPaymentToPaymentStatus(
            typeof payment.status === 'string' ? payment.status : null,
            typeof payment.status_detail === 'string' ? payment.status_detail : null,
          ) === PaymentStatus.APPROVED,
      );
      this.logger.log(
        `WEBHOOK_FEED_VERIFIED_VIA_API topic=merchant_order resourceId=${input.resourceId} ref=${ref} approved=${approved}`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `WEBHOOK_FEED_API_VERIFY_FAILED topic=${input.topic} resourceId=${input.resourceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private verifySignature(
    req: { headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> },
    manifestId: string | null,
    resourceId: string,
    topic: string,
  ) {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const secret =
      this.config.get<string>('MP_WEBHOOK_SECRET') ||
      this.config.get<string>('MP_WEBHOOK_SECRET_LIVE') ||
      this.config.get<string>('MP_WEBHOOK_SECRET_TEST');
    const strictPayment = this.isStrictPaymentEnabled(isProduction);
    const isPaymentTopic = topic === 'payment' || topic === 'merchant_order';

    if (!secret) {
      if (isProduction) {
        this.logger.error(
          'WEBHOOK_MP_SECRET_MISSING fail-closed: configure MP_WEBHOOK_SECRET antes de recibir cobros reales',
        );
        return { isValid: false, shouldReject: isPaymentTopic, requestId: undefined as string | undefined };
      }
      this.logger.warn(
        'WEBHOOK_MP_SECRET_MISSING_NON_STRICT dev-only: firma no verificada, no usar en produccion',
      );
      return { isValid: true, requestId: undefined, shouldReject: false };
    }

    const result = verifySignature({ headers: req.headers }, manifestId, secret);

    const receivedSignatureSnippet = result.v1?.slice(0, 8) ?? 'unknown';
    const calculatedHashSnippet = result.digest?.slice(0, 8) ?? 'unknown';
    const manifestHash = result.manifestHash ?? null;
    this.logger.debug(
      `WEBHOOK_MP_SIGNATURE_DEBUG received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} manifestSha256=${manifestHash ?? 'unknown'}`,
    );

    if (!result.isValid) {
      this.logger.warn(
        `WEBHOOK_MP_SIGNATURE_INVALID topic=${topic} ts=${result.ts ?? 'unknown'} received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} resourceId=${resourceId} requestId=${result.requestId ?? 'unknown'}`,
      );
      return {
        isValid: false,
        requestId: result.requestId,
        shouldReject: isPaymentTopic && strictPayment,
      };
    }

    const ts = Number(result.ts ?? 0);
    if (Number.isFinite(ts) && ts > 0) {
      const skewSec = Math.abs(Date.now() / 1000 - ts);
      if (skewSec > 300) {
        this.logger.warn(
          `WEBHOOK_MP_SIGNATURE_STALE topic=${topic} skewSec=${Math.round(skewSec)} resourceId=${resourceId} requestId=${result.requestId ?? 'unknown'}`,
        );
        return { isValid: false, requestId: result.requestId, shouldReject: true };
      }
    }

    if (topic === 'merchant_order') {
      this.logger.log(
        `WEBHOOK_MP_SIGNATURE_VALID topic=merchant_order requestId=${result.requestId ?? 'unknown'}`,
      );
    }

    return { isValid: true, requestId: result.requestId, shouldReject: false };
  }

  private isDumpEnabled() {
    const raw = this.config.get<string | boolean>('DEBUG_MP_WEBHOOK_DUMP');
    return raw === true || raw === 'true' || raw === '1';
  }

  private pickDumpHeaders(headers: Record<string, string | string[] | undefined>) {
    const picked: Record<string, unknown> = {};
    for (const name of ['x-signature', 'x-request-id', 'content-type', 'user-agent']) {
      if (headers[name] !== undefined) {
        picked[name] = headers[name];
      }
    }
    return picked;
  }

  private isStrictPaymentEnabled(isProduction = false) {
    if (isProduction) {
      return true;
    }
    const raw = this.config.get<string | boolean>('MP_WEBHOOK_STRICT_PAYMENT');
    if (raw === true || raw === 'true' || raw === '1') {
      return true;
    }
    return false;
  }
}

import { Body, Controller, Headers, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { MercadoPagoWebhookProcessorService } from '../services/mercadopago-webhook-processor.service';
import { getManifestId, getResourceId, verifySignature } from './mercadopago-webhook.utils';

@SkipThrottle()
@Controller('webhooks')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private config: ConfigService,
    private processor: MercadoPagoWebhookProcessorService,
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

    if (!resourceId) {
      this.logger.warn('WEBHOOK_MP_PAYMENT_ID_MISSING');
      response.status(200).json({ ok: true });
      return;
    }

    const manifestId = getManifestId({ topic, body, query });
    const signatureResult = this.verifySignature({ headers, body }, manifestId, resourceId, topic);
    if (!signatureResult.isValid && signatureResult.shouldReject) {
      response.status(401).json({ ok: false });
      return;
    }

    response.status(200).json({ ok: true });
    setImmediate(() => {
      void this.processor
        .processWebhook({
          body,
          query,
          resourceId,
          requestId: signatureResult.requestId,
          topic,
        })
        .catch((error) => {
          const message = error instanceof Error ? error.stack ?? error.message : String(error);
          this.logger.error(`WEBHOOK_PROCESSING_FAILED ${message}`);
        });
    });
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
      this.config.get<string>('MP_WEBHOOK_SECRET_LIVE');
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

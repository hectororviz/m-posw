import { Body, Controller, Headers, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { MercadoPagoWebhookProcessorService } from '../services/mercadopago-webhook-processor.service';
import { getResourceId, verifySignature } from './mercadopago-webhook.utils';

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
    const topic =
      (typeof body?.topic === 'string' && body.topic) ||
      (typeof body?.type === 'string' && body.type) ||
      query?.topic ||
      query?.type ||
      'unknown';

    const signatureResult = this.verifySignature({ headers, body }, resourceId, topic);
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
    resourceId: string,
    topic: string,
  ) {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');

    if (!secret) {
      if (isProduction) {
        this.logger.error('WEBHOOK_MP_SECRET_MISSING');
        if (topic === 'merchant_order') {
          return { isValid: false, shouldReject: false };
        }
        return { isValid: false, shouldReject: true };
      }
      this.logger.warn('WEBHOOK_MP_SECRET_MISSING_NON_STRICT');
      return { isValid: true, requestId: undefined, shouldReject: false };
    }

    const result = verifySignature({ headers: req.headers }, resourceId, secret);

    const receivedSignatureSnippet = result.v1?.slice(0, 8) ?? 'unknown';
    const calculatedHashSnippet = result.digest?.slice(0, 8) ?? 'unknown';
    const manifestHash = result.manifestHash ?? null;
    this.logger.debug(
      `WEBHOOK_MP_SIGNATURE_DEBUG received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} manifestSha256=${manifestHash ?? 'unknown'}`,
    );

    if (!result.isValid) {
      this.logger.warn(
        `WEBHOOK_MP_SIGNATURE_INVALID ts=${result.ts ?? 'unknown'} received=${receivedSignatureSnippet} calculated=${calculatedHashSnippet} resourceId=${resourceId} requestId=${result.requestId ?? 'unknown'}`,
      );
      if (topic === 'merchant_order') {
        this.logger.warn(
          `WEBHOOK_MP_SIGNATURE_INVALID_NON_STRICT topic=merchant_order requestId=${result.requestId ?? 'unknown'}`,
        );
        return { isValid: false, requestId: result.requestId, shouldReject: false };
      }
      if (isProduction) {
        return { isValid: false, requestId: result.requestId, shouldReject: true };
      }
      return { isValid: false, requestId: result.requestId, shouldReject: false };
    }

    return { isValid: true, requestId: result.requestId, shouldReject: false };
  }
}

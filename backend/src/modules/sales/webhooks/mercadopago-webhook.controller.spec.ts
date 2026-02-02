import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MercadoPagoWebhookProcessorService } from '../services/mercadopago-webhook-processor.service';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';
import {
  buildManifest,
  getManifestId,
  getResourceId,
  parseSignatureHeader,
  verifySignature,
} from './mercadopago-webhook.utils';

describe('MercadoPagoWebhookController', () => {
  it('acepta merchant_order sin firma valida y responde 200', async () => {
    const secret = 'secret';
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MP_WEBHOOK_SECRET') return secret;
        return null;
      }),
    } as unknown as ConfigService;

    const processor = {
      processWebhook: jest.fn().mockResolvedValue(undefined),
    } as unknown as MercadoPagoWebhookProcessorService;

    const controller = new MercadoPagoWebhookController(config, processor);

    const resourceId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    const signature = `ts=${ts}, v1=deadbeef`;

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleWebhook(
      { 'x-request-id': requestId, 'x-signature': signature },
      { type: 'merchant_order', data: { id: resourceId }, live_mode: true },
      { topic: 'merchant_order' },
      { method: 'POST', originalUrl: '/webhooks/mercadopago', url: '/webhooks/mercadopago' } as any,
      response as any,
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toHaveBeenCalledWith(200);
    expect(processor.processWebhook).toHaveBeenCalled();
  });

  it('rechaza payment con firma invalida cuando el modo estricto esta habilitado', async () => {
    const secret = 'secret';
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MP_WEBHOOK_SECRET') return secret;
        if (key === 'MP_WEBHOOK_STRICT_PAYMENT') return 'true';
        return null;
      }),
    } as unknown as ConfigService;

    const processor = {
      processWebhook: jest.fn().mockResolvedValue(undefined),
    } as unknown as MercadoPagoWebhookProcessorService;

    const controller = new MercadoPagoWebhookController(config, processor);

    const resourceId = '456';
    const requestId = 'req-2';
    const ts = '1700000000';
    const signature = `ts=${ts}, v1=deadbeef`;

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleWebhook(
      { 'x-request-id': requestId, 'x-signature': signature },
      { type: 'payment', data: { id: resourceId } },
      { topic: 'payment' },
      { method: 'POST', originalUrl: '/webhooks/mercadopago', url: '/webhooks/mercadopago' } as any,
      response as any,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(processor.processWebhook).not.toHaveBeenCalled();
  });

  it('obtiene resourceId desde data.id y type', () => {
    const resourceId = getResourceId({
      query: { type: 'payment', 'data.id': '143523357831' },
      body: { data: { id: '143523357831' } },
    });

    expect(resourceId).toBe('143523357831');
  });

  it('obtiene resourceId desde id con topic payment (feed v2)', () => {
    const resourceId = getResourceId({
      query: { id: '143523357831', topic: 'payment' },
      body: { resource: 'https://api.mercadopago.com/v1/payments/143523357831' },
    });

    expect(resourceId).toBe('143523357831');
  });

  it('obtiene resourceId desde body.data.id si no hay query', () => {
    const resourceId = getResourceId({
      query: {},
      body: { data: { id: 987654 } },
    });

    expect(resourceId).toBe('987654');
  });

  it('obtiene resourceId desde resource URL de merchant_order', () => {
    const resourceId = getResourceId({
      query: { topic: 'merchant_order', id: '37735080629' },
      body: { resource: 'https://api.mercadopago.com/merchant_orders/37735080629' },
    });

    expect(resourceId).toBe('37735080629');
  });

  it('usa resource URL como manifestId para merchant_order', () => {
    const manifestId = getManifestId({
      topic: 'merchant_order',
      query: { topic: 'merchant_order', id: '37735080629' },
      body: { resource: 'https://api.mercadopago.com/merchant_orders/37735080629' },
    });

    expect(manifestId).toBe('https://api.mercadopago.com/merchant_orders/37735080629');
  });

  it('parsea el header x-signature con ts y v1', () => {
    const parsed = parseSignatureHeader('ts=1700000000, v1=abc123');

    expect(parsed).toEqual({ ts: '1700000000', v1: 'abc123' });
  });

  it('verifica firma valida con manifest correcto', () => {
    const secret = 'secret';
    const manifestId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${manifestId};request-id:${requestId};ts:${ts};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    const signature = `ts=${ts}, v1=${digest}`;

    const result = verifySignature(
      { headers: { 'x-request-id': requestId, 'x-signature': signature } },
      manifestId,
      secret,
    );

    expect(result.isValid).toBe(true);
  });

  it('arma el manifest correcto', () => {
    expect(buildManifest('123', 'req-1', '1700000000')).toBe(
      'id:123;request-id:req-1;ts:1700000000;',
    );
  });

  it('marca firma invalida cuando el digest no coincide', () => {
    const secret = 'secret';
    const manifestId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const signature = `ts=${ts}, v1=deadbeef`;

    const result = verifySignature(
      { headers: { 'x-request-id': requestId, 'x-signature': signature } },
      manifestId,
      secret,
    );

    expect(result.isValid).toBe(false);
  });
});

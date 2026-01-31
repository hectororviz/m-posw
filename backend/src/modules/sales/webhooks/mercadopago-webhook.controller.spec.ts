import { ConfigService } from '@nestjs/config';
import { PaymentStatus, SaleStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from '../services/mercadopago-query.service';
import { SalesGateway } from '../websockets/sales.gateway';
import {
  getResourceId,
  MercadoPagoWebhookController,
  parseSignatureHeader,
  verifySignature,
} from './mercadopago-webhook.controller';

describe('MercadoPagoWebhookController', () => {
  it('marca la venta como pagada cuando el pago es aprobado', async () => {
    const secret = 'secret';
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'MP_WEBHOOK_SECRET') return secret;
        return null;
      }),
    } as unknown as ConfigService;

    const prisma = {
      sale: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'sale-1',
            status: SaleStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
          }),
        update: jest.fn().mockResolvedValue({ id: 'sale-1', paymentStatus: PaymentStatus.OK }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    } as unknown as PrismaService;

    const mpService = {
      getPayment: jest.fn().mockResolvedValue({
        external_reference: 'sale-sale-1',
        status: 'approved',
        status_detail: 'accredited',
        date_approved: '2024-01-01T00:00:00.000Z',
      }),
    } as unknown as MercadoPagoQueryService;

    const salesGateway = {
      notifyPaymentStatusChanged: jest.fn(),
    } as unknown as SalesGateway;

    const controller = new MercadoPagoWebhookController(config, prisma, mpService, salesGateway);

    const resourceId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    const signature = `ts=${ts}, v1=${digest}`;

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.handleWebhook(
      { 'x-request-id': requestId, 'x-signature': signature },
      { type: 'payment', data: { id: resourceId }, live_mode: true },
      {},
      { method: 'POST', originalUrl: '/webhooks/mercadopago', url: '/webhooks/mercadopago' } as any,
      response as any,
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaleStatus.APPROVED }),
      }),
    );
  });

  it('obtiene resourceId desde data.id y type', () => {
    const resourceId = getResourceId({
      query: { type: 'payment', 'data.id': '143523357831' },
      body: { data: { id: '143523357831' } },
    });

    expect(resourceId).toBe('143523357831');
  });

  it('obtiene resourceId desde id con topic payment', () => {
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

  it('obtiene resourceId desde resource URL de payments', () => {
    const resourceId = getResourceId({
      query: { topic: 'merchant_order', id: '37735080629' },
      body: { resource: 'https://api.mercadopago.com/v1/payments/37735080629' },
    });

    expect(resourceId).toBe('37735080629');
  });

  it('parsea el header x-signature con ts y v1', () => {
    const parsed = parseSignatureHeader('ts=1700000000, v1=abc123');

    expect(parsed).toEqual({ ts: '1700000000', v1: 'abc123' });
  });

  it('verifica firma valida con manifest correcto', () => {
    const secret = 'secret';
    const resourceId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    const signature = `ts=${ts}, v1=${digest}`;

    const result = verifySignature(
      { headers: { 'x-request-id': requestId, 'x-signature': signature } },
      resourceId,
      secret,
    );

    expect(result.isValid).toBe(true);
  });
});

import { ConfigService } from '@nestjs/config';
import { PaymentStatus, SaleStatus } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from '../services/mercadopago-query.service';
import { SalesGateway } from '../websockets/sales.gateway';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';

describe('MercadoPagoWebhookController', () => {
  it('marca la venta como pagada cuando el pago es aprobado', async () => {
    const secret = 'secret';
    const config = {
      get: jest.fn((key: string) => (key === 'MP_WEBHOOK_SECRET' ? secret : null)),
    } as unknown as ConfigService;

    const prisma = {
      sale: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'sale-1', status: SaleStatus.PENDING, paymentStatus: PaymentStatus.PENDING }),
        update: jest.fn().mockResolvedValue({ id: 'sale-1', paymentStatus: PaymentStatus.APPROVED }),
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
      getMerchantOrder: jest.fn(),
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

    await controller.handleWebhook(
      { type: 'payment', data: { id: resourceId } },
      {},
      { 'x-request-id': requestId, 'x-signature': signature },
    );

    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaleStatus.APPROVED }),
      }),
    );
  });
});

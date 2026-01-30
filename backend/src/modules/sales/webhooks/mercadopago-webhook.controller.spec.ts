import { ConfigService } from '@nestjs/config';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoInstoreService } from '../services/mercadopago-instore.service';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';

describe('MercadoPagoWebhookController', () => {
  it('marca la venta como pagada cuando el pago es aprobado', async () => {
    const config = {
      get: jest.fn((key: string) => (key === 'MP_WEBHOOK_SECRET' ? 'secret' : null)),
    } as unknown as ConfigService;

    const prisma = {
      sale: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sale-1', status: SaleStatus.PENDING }),
        update: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      },
      mercadoPagoPayment: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
    } as unknown as PrismaService;

    const mpService = {
      getPayment: jest.fn().mockResolvedValue({
        external_reference: 'sale-sale-1',
        status: 'approved',
        date_approved: '2024-01-01T00:00:00.000Z',
      }),
    } as unknown as MercadoPagoInstoreService;

    const controller = new MercadoPagoWebhookController(config, prisma, mpService);

    await controller.handleWebhook({ data: { id: '123' } }, 'secret');

    expect(prisma.mercadoPagoPayment.create).toHaveBeenCalled();
    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaleStatus.APPROVED }),
      }),
    );
  });
});

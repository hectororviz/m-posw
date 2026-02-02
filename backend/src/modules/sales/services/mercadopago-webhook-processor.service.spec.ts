import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from './mercadopago-query.service';
import { MercadoPagoWebhookProcessorService } from './mercadopago-webhook-processor.service';
import { SalesGateway } from '../websockets/sales.gateway';

describe('MercadoPagoWebhookProcessorService', () => {
  it('marca la venta como pagada cuando el pago es aprobado', async () => {
    const PaymentStatus = {
      OK: 'OK',
      PENDING: 'PENDING',
    } as const;
    const SaleStatus = {
      APPROVED: 'APPROVED',
      PENDING: 'PENDING',
    } as const;

    const prisma = {
      sale: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sale-1',
          status: SaleStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          mpMerchantOrderId: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'sale-1',
          status: SaleStatus.APPROVED,
          paymentStatus: PaymentStatus.OK,
        }),
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

    const processor = new MercadoPagoWebhookProcessorService(prisma, mpService, salesGateway);

    await processor.processWebhook({
      body: { type: 'payment' },
      query: {},
      resourceId: '123',
      requestId: 'req-1',
      topic: 'payment',
    });

    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaleStatus.APPROVED }),
      }),
    );
  });
});

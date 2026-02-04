import { PrismaService } from '../../common/prisma.service';
import { MercadoPagoQueryService } from './mercadopago-query.service';
import { MercadoPagoWebhookProcessorService } from './mercadopago-webhook-processor.service';
import { SalesGateway } from '../websockets/sales.gateway';

describe('MercadoPagoWebhookProcessorService', () => {
  it('marca la venta como pagada cuando el pago es aprobado', async () => {
    const PaymentStatus = {
      APPROVED: 'APPROVED',
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
          paymentStatus: PaymentStatus.APPROVED,
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
      getMerchantOrderByResource: jest.fn(),
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

  it('marca la venta como pendiente cuando merchant_order no tiene pagos', async () => {
    const PaymentStatus = {
      PENDING: 'PENDING',
    } as const;
    const SaleStatus = {
      APPROVED: 'APPROVED',
      PENDING: 'PENDING',
    } as const;

    const prisma = {
      sale: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 'sale-2',
          status: SaleStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          mpMerchantOrderId: 'mo-1',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'sale-2',
          status: SaleStatus.PENDING,
          paymentStatus: null,
          mpMerchantOrderId: null,
        }),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-2' }),
      },
    } as unknown as PrismaService;

    const mpService = {
      getMerchantOrderByResource: jest.fn().mockResolvedValue({
        id: 'mo-1',
        external_reference: 'sale-sale-2',
        payments: [],
      }),
      getPayment: jest.fn(),
    } as unknown as MercadoPagoQueryService;

    const salesGateway = {
      notifyPaymentStatusChanged: jest.fn(),
    } as unknown as SalesGateway;

    const processor = new MercadoPagoWebhookProcessorService(prisma, mpService, salesGateway);

    await processor.processWebhook({
      body: { type: 'merchant_order', resource: 'https://api.mercadopago.com/merchant_orders/mo-1' },
      query: {},
      resourceId: 'mo-1',
      requestId: 'req-2',
      topic: 'merchant_order',
    });

    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: PaymentStatus.PENDING }),
      }),
    );
    expect(mpService.getPayment).not.toHaveBeenCalled();
  });
});

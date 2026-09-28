import { PaymentMethod, PaymentStatus, SaleStatus } from '@prisma/client';
import { SalesService } from './sales.service';

const buildService = (overrides: {
  sale?: unknown;
  searchResults?: unknown;
  searchThrows?: boolean;
  deleteThrows?: unknown;
}) => {
  const baseSale = (overrides.sale ?? {}) as Record<string, unknown>;
  const prisma = {
    sale: {
      findUnique: jest.fn().mockResolvedValue(overrides.sale),
      update: jest.fn().mockImplementation(({ data }: any) => ({ ...baseSale, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    saleItem: { findMany: jest.fn().mockResolvedValue([]) },
    product: { update: jest.fn() },
  } as any;
  const mpQueryService = {
    searchPaymentsByExternalReference: overrides.searchThrows
      ? jest.fn().mockRejectedValue(new Error('MP 500'))
      : jest.fn().mockResolvedValue(overrides.searchResults ?? { results: [] }),
  } as any;
  const mpService = {
    deleteOrder: overrides.deleteThrows
      ? jest.fn().mockRejectedValue(overrides.deleteThrows)
      : jest.fn().mockResolvedValue(undefined),
  } as any;
  const internetVouchers = { generateVouchersForSale: jest.fn().mockResolvedValue([]) } as any;
  const service = new SalesService(prisma, {} as any, mpService, mpQueryService, internetVouchers, {} as any);
  return { service, prisma, mpQueryService, mpService, internetVouchers };
};

const pendingSale = {
  id: 'sale-1',
  userId: 'user-1',
  status: SaleStatus.PENDING,
  paymentStatus: PaymentStatus.PENDING,
  paymentMethod: PaymentMethod.MP_QR,
  paymentStartedAt: new Date(Date.now() - 20 * 60 * 1000),
  updatedAt: new Date(),
  statusUpdatedAt: new Date(),
  mpPaymentId: null,
  mpStatus: null,
  mpStatusDetail: null,
  mpMerchantOrderId: null,
};

describe('SalesService expire race (post-incidente #1803)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aprueba en vez de expirar si MP tiene pago aprobado', async () => {
    const { service, prisma, mpService, internetVouchers } = buildService({
      sale: pendingSale,
      searchResults: {
        results: [{ id: 999, status: 'approved', status_detail: 'accredited' }],
      },
    });

    const result = await service.getPaymentStatus('sale-1', { id: 'user-1', role: 'USER' });

    expect(mpService.deleteOrder).not.toHaveBeenCalled();
    expect(prisma.sale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'sale-1', status: SaleStatus.PENDING }),
        data: expect.objectContaining({
          status: SaleStatus.APPROVED,
          paymentStatus: PaymentStatus.APPROVED,
          mpPaymentId: '999',
        }),
      }),
    );
    expect(internetVouchers.generateVouchersForSale).toHaveBeenCalledWith('sale-1');
    expect(result.status).toBe(PaymentStatus.APPROVED);
  });

  it('no duplica stock si otro camino ya finalizó (race perdido)', async () => {
    const built = buildService({
      sale: pendingSale,
      searchResults: {
        results: [{ id: 999, status: 'approved', status_detail: 'accredited' }],
      },
    });
    built.prisma.sale.updateMany.mockResolvedValue({ count: 0 });
    const decrement = jest.spyOn(built.service, 'decrementStockForSale').mockResolvedValue(undefined);

    await built.service.getPaymentStatus('sale-1', { id: 'user-1', role: 'USER' });

    expect(decrement).not.toHaveBeenCalled();
    expect(built.internetVouchers.generateVouchersForSale).not.toHaveBeenCalled();
  });

  it('expira si MP no tiene pagos', async () => {
    const { service, mpService } = buildService({ sale: pendingSale });

    await service.getPaymentStatus('sale-1', { id: 'user-1', role: 'USER' });

    expect(mpService.deleteOrder).toHaveBeenCalled();
  });

  it('cancelQrSale tolera 404 con shape {response:{status}}', async () => {
    const { service, prisma } = buildService({
      sale: { ...pendingSale, paymentStartedAt: new Date() },
      deleteThrows: { response: { status: 404, data: 'not found' } },
    });

    const result = await service.cancelQrSale('sale-1', { id: 'user-1', role: 'USER' });

    expect(result.status).toBe(SaleStatus.CANCELLED);
    expect(prisma.sale.update).toHaveBeenCalled();
  });

  it('cancelQrSale relanza errores que no son 404', async () => {
    const { service } = buildService({
      sale: { ...pendingSale, paymentStartedAt: new Date() },
      deleteThrows: { response: { status: 500, data: 'mp down' } },
    });

    await expect(service.cancelQrSale('sale-1', { id: 'user-1', role: 'USER' })).rejects.toEqual(
      expect.objectContaining({ response: expect.objectContaining({ status: 500 }) }),
    );
  });

  it('cancelQrSale tolera 400 in_store_order_delete_error (zombies)', async () => {
    const { service, prisma } = buildService({
      sale: { ...pendingSale, paymentStartedAt: new Date() },
      deleteThrows: {
        response: {
          status: 400,
          data: '{"error":"in_store_order_delete_error","message":"An error occurred when deleting the InStoreOrder","status":400,"causes":[]}',
        },
      },
    });

    const result = await service.cancelQrSale('sale-1', { id: 'user-1', role: 'USER' });

    expect(result.status).toBe(SaleStatus.CANCELLED);
    expect(prisma.sale.update).toHaveBeenCalled();
  });
});

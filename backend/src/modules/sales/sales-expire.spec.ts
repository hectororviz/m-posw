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
    },
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
  const service = new SalesService(prisma, {} as any, mpService, mpQueryService, {} as any, {} as any);
  return { service, prisma, mpQueryService, mpService };
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
    const { service, prisma, mpService } = buildService({
      sale: pendingSale,
      searchResults: {
        results: [{ id: 999, status: 'approved', status_detail: 'accredited' }],
      },
    });

    const result = await service.getPaymentStatus('sale-1', { id: 'user-1', role: 'USER' });

    expect(mpService.deleteOrder).not.toHaveBeenCalled();
    expect(prisma.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: PaymentStatus.APPROVED, mpPaymentId: '999' }),
      }),
    );
    expect(result.status).toBe(PaymentStatus.APPROVED);
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
});

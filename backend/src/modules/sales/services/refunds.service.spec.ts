import { PaymentMethod, PaymentStatus, SaleStatus } from '@prisma/client';
import { PaymentRefund } from 'mercadopago';
import { RefundsService } from './refunds.service';

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  PaymentRefund: jest.fn(),
}));

const baseSale = {
  id: 'sale-1',
  paymentMethod: PaymentMethod.MP_QR,
  paymentStatus: PaymentStatus.APPROVED,
  status: SaleStatus.APPROVED,
  refundedAt: null,
  mpPaymentId: '999',
  mpRaw: null,
  items: [],
};

const buildService = (overrides: {
  sale?: unknown;
  txSale?: unknown;
  refundImpl?: jest.Mock | null;
}) => {
  const createMock = overrides.refundImpl ?? jest.fn().mockResolvedValue({ id: 1 });
  (PaymentRefund as unknown as jest.Mock).mockImplementation(() => ({ create: createMock }));
  const txSale = overrides.txSale ?? { ...baseSale };
  const tx = {
    sale: {
      findUnique: jest.fn().mockResolvedValue(txSale),
      update: jest.fn().mockImplementation(({ data }: any) => ({ ...baseSale, ...data })),
    },
  };
  const prisma = {
    sale: { findUnique: jest.fn().mockResolvedValue(overrides.sale ?? baseSale) },
    saleItem: { findMany: jest.fn().mockResolvedValue([]) },
    product: { update: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(tx)),
  } as any;
  const mpConfig = { getAccessToken: jest.fn().mockResolvedValue('token') } as any;
  const vouchers = { deactivateBySale: jest.fn().mockResolvedValue({}) } as any;
  return { service: new RefundsService(prisma, mpConfig, vouchers), prisma, vouchers, createMock };
};

describe('RefundsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza usuarios no ADMIN', async () => {
    const { service } = buildService({});
    await expect(service.refundSale('sale-1', { id: 'u1', role: 'USER' })).rejects.toThrow(
      'Solo un administrador puede reembolsar ventas',
    );
  });

  it('rechaza ventas que no son MP_QR', async () => {
    const { service } = buildService({
      sale: { ...baseSale, paymentMethod: PaymentMethod.CASH },
    });
    await expect(service.refundSale('sale-1', { id: 'u1', role: 'ADMIN' })).rejects.toThrow(
      'Solo se pueden reembolsar ventas con QR de Mercado Pago',
    );
  });

  it('rechaza ventas ya reembolsadas', async () => {
    const { service } = buildService({
      sale: { ...baseSale, refundedAt: new Date() },
    });
    await expect(service.refundSale('sale-1', { id: 'u1', role: 'ADMIN' })).rejects.toThrow(
      'La venta ya fue reembolsada',
    );
  });

  it('reembolsa venta QR aprobada y revierte estado', async () => {
    const { service, prisma, vouchers, createMock } = buildService({});
    const result = await service.refundSale('sale-1', { id: 'admin-1', role: 'ADMIN' });

    expect(createMock).toHaveBeenCalledWith({
      payment_id: '999',
      requestOptions: { idempotencyKey: 'refund:sale-1' },
    });
    expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    expect(result.status).toBe(SaleStatus.REJECTED);
    expect(vouchers.deactivateBySale).toHaveBeenCalledWith('sale-1');
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('mapea error de MP ya-reembolsado a conflicto', async () => {
    const { service } = buildService({
      refundImpl: jest.fn().mockRejectedValue(new Error('payment already refunded')),
    });
    await expect(service.refundSale('sale-1', { id: 'u1', role: 'ADMIN' })).rejects.toThrow(
      'ya fue reembolsado',
    );
  });
});

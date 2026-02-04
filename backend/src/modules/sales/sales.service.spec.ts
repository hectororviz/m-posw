import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesService } from './sales.service';

describe('SalesService MercadoPago QR auth', () => {
  const PaymentStatus = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
  } as const;
  const SaleStatus = {
    PENDING: 'PENDING',
    CANCELLED: 'CANCELLED',
  } as const;
  const baseSale = {
    id: 'sale-1',
    userId: 'owner-1',
    total: 100,
    status: SaleStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentStartedAt: null,
    paymentMethod: 'MP_QR',
    items: [
      {
        product: { name: 'Item A', price: 100 },
        quantity: 1,
        subtotal: 100,
      },
    ],
    user: {
      id: 'owner-1',
      externalPosId: 'POS-1',
      externalStoreId: 'STORE-1',
    },
  };

  const buildService = () => {
    const prisma = {
      sale: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
    };
    const config = {
      get: jest.fn().mockReturnValue('STORE-DEFAULT'),
    } as unknown as ConfigService;
    const mpService = {
      createOrUpdateOrder: jest.fn(),
      deleteOrder: jest.fn(),
    };
    const mpQueryService = {
      searchPaymentsByExternalReference: jest.fn(),
    };

    return {
      service: new SalesService(prisma as any, config, mpService as any, mpQueryService as any),
      prisma,
      mpService,
      mpQueryService,
    };
  };

  it('permite a ADMIN consultar estado aunque no sea owner', async () => {
    const { service, prisma } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);

    const result = await service.getSaleStatus(baseSale.id, {
      id: 'admin-1',
      role: 'ADMIN',
    });

    expect(result.status).toBe(SaleStatus.PENDING);
  });

  it('bloquea a non-admin si intenta cobrar ventas ajenas', async () => {
    const { service, prisma, mpService } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);

    await expect(
      service.cancelQrSale(baseSale.id, { id: 'user-2', role: 'USER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mpService.deleteOrder).not.toHaveBeenCalled();
  });

  it('permite a ADMIN cancelar el cobro aunque no sea owner', async () => {
    const { service, prisma, mpService } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);
    prisma.sale.update.mockResolvedValue({
      ...baseSale,
      status: SaleStatus.CANCELLED,
    });

    const result = await service.cancelQrSale(baseSale.id, {
      id: 'admin-1',
      role: 'ADMIN',
    });

    expect(result.status).toBe(SaleStatus.CANCELLED);
    expect(mpService.deleteOrder).toHaveBeenCalledTimes(1);
  });

  it('marca el ticket como impreso si no estaba registrado', async () => {
    const { service, prisma } = buildService();
    prisma.sale.findUnique.mockResolvedValue({ ...baseSale, ticketPrintedAt: null });
    const printedAt = new Date('2025-01-01T10:00:00.000Z');
    prisma.sale.update.mockResolvedValue({ ...baseSale, ticketPrintedAt: printedAt });

    const result = await service.markTicketPrinted(baseSale.id, {
      id: 'owner-1',
      role: 'USER',
    });

    expect(prisma.sale.update).toHaveBeenCalledTimes(1);
    expect(result.alreadyPrinted).toBe(false);
    expect(result.ticketPrintedAt).toEqual(printedAt);
  });

  it('evita volver a marcar el ticket si ya estaba impreso', async () => {
    const { service, prisma } = buildService();
    const printedAt = new Date('2025-01-01T10:00:00.000Z');
    prisma.sale.findUnique.mockResolvedValue({ ...baseSale, ticketPrintedAt: printedAt });

    const result = await service.markTicketPrinted(baseSale.id, {
      id: 'owner-1',
      role: 'USER',
    });

    expect(prisma.sale.update).not.toHaveBeenCalled();
    expect(result.alreadyPrinted).toBe(true);
    expect(result.ticketPrintedAt).toEqual(printedAt);
  });
});

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaleStatus } from '@prisma/client';
import { SalesService } from './sales.service';

describe('SalesService MercadoPago QR auth', () => {
  const baseSale = {
    id: 'sale-1',
    userId: 'owner-1',
    total: 100,
    status: SaleStatus.OPEN,
    paymentStartedAt: null,
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

    return {
      service: new SalesService(prisma as any, config, mpService as any),
      prisma,
      mpService,
    };
  };

  it('permite a ADMIN iniciar el cobro aunque no sea owner', async () => {
    const { service, prisma, mpService } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);
    const updatedSale = {
      ...baseSale,
      status: SaleStatus.PENDING_PAYMENT,
      paymentStartedAt: new Date(),
    };
    prisma.sale.update.mockResolvedValue(updatedSale);

    const result = await service.startMercadoPagoPayment(
      baseSale.id,
      { id: 'admin-1', role: 'ADMIN', sub: 'admin-1' },
      'POST /sales/:id/payments/mercadopago-qr',
    );

    expect(result.status).toBe(SaleStatus.PENDING_PAYMENT);
    expect(mpService.createOrUpdateOrder).toHaveBeenCalledTimes(1);
  });

  it('bloquea a non-admin si intenta cobrar ventas ajenas', async () => {
    const { service, prisma, mpService } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);

    await expect(
      service.startMercadoPagoPayment(
        baseSale.id,
        { id: 'user-2', role: 'USER', sub: 'user-2' },
        'POST /sales/:id/payments/mercadopago-qr',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mpService.createOrUpdateOrder).not.toHaveBeenCalled();
  });

  it('permite a ADMIN cancelar el cobro aunque no sea owner', async () => {
    const { service, prisma, mpService } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);
    prisma.sale.update.mockResolvedValue({
      ...baseSale,
      status: SaleStatus.CANCELLED,
    });

    const result = await service.cancelMercadoPagoPayment(
      baseSale.id,
      { id: 'admin-1', role: 'ADMIN', sub: 'admin-1' },
      'POST /sales/:id/payments/mercadopago-qr/cancel',
    );

    expect(result.status).toBe(SaleStatus.CANCELLED);
    expect(mpService.deleteOrder).toHaveBeenCalledTimes(1);
  });

  it('falla si se intenta autorizar con sessionId en lugar de userId', async () => {
    const { service, prisma } = buildService();
    prisma.sale.findUnique.mockResolvedValue(baseSale);

    await expect(
      service.cancelMercadoPagoPayment(
        baseSale.id,
        { id: 'session-1', role: 'USER', sub: 'session-1' },
        'POST /sales/:id/payments/mercadopago-qr/cancel',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

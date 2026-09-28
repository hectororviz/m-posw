import { SaleStatus } from '@prisma/client';
import { SalesService } from './sales.service';

describe('SalesService.cleanupExpiredQrSales (Fase 5 L2)', () => {
  it('cancela ventas PENDING >15min y tolera fallos por venta', async () => {
    const prisma = {
      sale: {
        findMany: jest.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
      },
    } as any;
    const service = new SalesService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    const cancel = jest
      .spyOn(service, 'cancelQrSale')
      .mockRejectedValueOnce(new Error('MP 500'))
      .mockResolvedValueOnce({ saleId: 's2', status: SaleStatus.CANCELLED });

    await service.cleanupExpiredQrSales();

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledWith('s1', { id: 'system-cron', role: 'ADMIN' });
  });

  it('no hace nada si no hay vencidas', async () => {
    const prisma = { sale: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new SalesService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    const cancel = jest.spyOn(service, 'cancelQrSale');

    await service.cleanupExpiredQrSales();

    expect(cancel).not.toHaveBeenCalled();
  });
});

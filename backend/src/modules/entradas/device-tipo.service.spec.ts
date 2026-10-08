import { ConflictException } from '@nestjs/common';
import { EntradasAdminService } from './entradas-admin.service';

function makeService(pendingCount: number, currentTipo: 'ENTRADAS' | 'POS' = 'ENTRADAS') {
  const prisma: any = {
    posDevice: {
      findUnique: jest.fn().mockResolvedValue({ id: 'd1', nombre: 'Puerta', tipo: currentTipo }),
      update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'd1', nombre: 'Puerta', tipo: args.data.tipo })),
    },
    ticketSale: {
      count: jest.fn().mockResolvedValue(pendingCount),
    },
  };
  const service = new EntradasAdminService(prisma as never, {} as never);
  return { service, prisma };
}

describe('updateDeviceTipo', () => {
  it('mismo tipo → no toca la DB de ventas', async () => {
    const { service, prisma } = makeService(5, 'ENTRADAS');
    await expect(service.updateDeviceTipo('d1', 'entradas')).resolves.toMatchObject({ tipo: 'ENTRADAS' });
    expect(prisma.ticketSale.count).not.toHaveBeenCalled();
    expect(prisma.posDevice.update).not.toHaveBeenCalled();
  });

  it('con pendientes y sin force → 409 DEVICE_HAS_PENDING_SALES', async () => {
    const { service } = makeService(3, 'ENTRADAS');
    try {
      await service.updateDeviceTipo('d1', 'POS');
      fail('debió rechazar con 409');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'DEVICE_HAS_PENDING_SALES' });
    }
  });

  it('con pendientes y force → cambia igual', async () => {
    const { service } = makeService(3, 'ENTRADAS');
    await expect(service.updateDeviceTipo('d1', 'POS', true)).resolves.toMatchObject({ tipo: 'POS' });
  });

  it('sin pendientes → cambia', async () => {
    const { service } = makeService(0, 'ENTRADAS');
    await expect(service.updateDeviceTipo('d1', 'POS')).resolves.toMatchObject({ tipo: 'POS' });
  });

  it('tipo inválido → 400', async () => {
    const { service } = makeService(0);
    await expect(service.updateDeviceTipo('d1', 'KIOSCO')).rejects.toThrow('Tipo de dispositivo inválido');
  });
});

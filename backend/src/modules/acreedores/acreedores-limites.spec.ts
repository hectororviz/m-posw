import { BadRequestException } from '@nestjs/common';
import { AcreedoresService } from './acreedores.service';

describe('AcreedoresService limites de deuda', () => {
  const buildService = (acreedor: any, sums: { fiado: number; ajustes: number; pagos: number }) => {
    const prisma = {
      acreedor: {
        findUnique: jest.fn().mockResolvedValue(acreedor),
        create: jest.fn(),
        update: jest.fn(),
      },
      fiadoVenta: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: sums.fiado } }),
      },
      ajusteAcreedor: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: sums.ajustes } }),
      },
      pagoAcreedor: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: sums.pagos } }),
      },
    };
    const service = new AcreedoresService(prisma as any, {} as any, {} as any, {} as any);
    return { service, prisma };
  };

  it('estadoDeuda: OK bajo advertencia, ADVERTENCIA sobre aviso, LIMITE sobre tope', () => {
    const { service } = buildService({}, { fiado: 0, ajustes: 0, pagos: 0 });
    expect(service.estadoDeuda(5000, 20000, 10000)).toBe('OK');
    expect(service.estadoDeuda(12000, 20000, 10000)).toBe('ADVERTENCIA');
    expect(service.estadoDeuda(25000, 20000, 10000)).toBe('LIMITE');
    expect(service.estadoDeuda(25000, 20000, null)).toBe('LIMITE');
    expect(service.estadoDeuda(0, 20000, 10000)).toBe('OK');
    expect(service.estadoDeuda(-500, 20000, 10000)).toBe('OK');
    expect(service.estadoDeuda(999999, null, null)).toBe('OK');
  });

  it('assertLimiteNoSuperado: permite si no hay limite', async () => {
    const { service } = buildService(
      { id: 1, limiteDeuda: null },
      { fiado: 50000, ajustes: 0, pagos: 0 },
    );
    await expect(service.assertLimiteNoSuperado(1, 100000)).resolves.toBeUndefined();
  });

  it('assertLimiteNoSuperado: bloquea si el proyectado supera el limite', async () => {
    const { service } = buildService(
      { id: 1, limiteDeuda: '20000' },
      { fiado: 15000, ajustes: 0, pagos: 0 },
    );
    await expect(service.assertLimiteNoSuperado(1, 6000)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assertLimiteNoSuperado: bloquea deuda actual ya sobre el limite aunque el monto sea chico', async () => {
    const { service } = buildService(
      { id: 1, limiteDeuda: '20000' },
      { fiado: 25000, ajustes: 0, pagos: 0 },
    );
    await expect(service.assertLimiteNoSuperado(1, 100)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assertLimiteNoSuperado: permite si el proyectado iguala el limite', async () => {
    const { service } = buildService(
      { id: 1, limiteDeuda: '20000' },
      { fiado: 15000, ajustes: 0, pagos: 0 },
    );
    await expect(service.assertLimiteNoSuperado(1, 5000)).resolves.toBeUndefined();
  });

  it('assertLimiteNoSuperado: la advertencia nunca bloquea', async () => {
    const { service } = buildService(
      { id: 1, limiteDeuda: null, advertenciaDeuda: '10000' },
      { fiado: 5000, ajustes: 0, pagos: 0 },
    );
    await expect(service.assertLimiteNoSuperado(1, 6000)).resolves.toBeUndefined();
  });

  it('create: rechaza limite menor que advertencia', async () => {
    const { service } = buildService({}, { fiado: 0, ajustes: 0, pagos: 0 });
    await expect(
      service.create({ nombre: 'X', limiteDeuda: 5000, advertenciaDeuda: 10000 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: rechaza limite menor que advertencia combinando con valores actuales', async () => {
    const { service, prisma } = buildService(
      { id: 1, limiteDeuda: '20000', advertenciaDeuda: '10000' },
      { fiado: 0, ajustes: 0, pagos: 0 },
    );
    await expect(service.update(1, { limiteDeuda: 5000 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.acreedor.update).not.toHaveBeenCalled();
  });
});

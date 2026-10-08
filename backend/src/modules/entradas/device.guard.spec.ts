import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DeviceGuard } from './device.guard';
import { DEVICE_KIND_KEY } from './device-kind.decorator';
import { generateDeviceToken } from './device-token.util';

function makeGuard(deviceRow: any, requiredKind: 'entradas' | 'pos' | undefined) {
  const prisma: any = {
    posDevice: {
      findUnique: jest.fn().mockResolvedValue(deviceRow),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const reflector: any = {
    getAllAndOverride: jest.fn((key: string) => (key === DEVICE_KIND_KEY ? requiredKind : undefined)),
  };
  const guard = new DeviceGuard(prisma as never, reflector as never);
  return { guard, prisma };
}

function makeContext(tokenHeader: string | undefined) {
  const request: any = { headers: { authorization: tokenHeader } };
  const context: any = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
  return { context, request };
}

describe('DeviceGuard', () => {
  it('sin token → 401 DEVICE_TOKEN_MISSING', async () => {
    const { guard } = makeGuard(null, undefined);
    const { context } = makeContext(undefined);
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: { code: 'DEVICE_TOKEN_MISSING' },
    });
  });

  it('token revocado → 401 DEVICE_REVOKED', async () => {
    const token = generateDeviceToken();
    const { guard } = makeGuard({ id: 'd1', nombre: 'Puerta', tipo: 'ENTRADAS', activo: false, revokedAt: new Date() }, undefined);
    const { context } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token válido sin @DeviceKind → pasa y expone device con tipo', async () => {
    const token = generateDeviceToken();
    const { guard, prisma } = makeGuard(
      { id: 'd1', nombre: 'Puerta', tipo: 'ENTRADAS', activo: true, revokedAt: null },
      undefined,
    );
    const { context, request } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.device).toMatchObject({ id: 'd1', tipo: 'ENTRADAS' });
    expect(request.entradasDevice).toBe(request.device);
    expect(prisma.posDevice.update).toHaveBeenCalled();
  });

  it('dispositivo ENTRADAS en ruta pos → 403 DEVICE_WRONG_MODE', async () => {
    const token = generateDeviceToken();
    const { guard } = makeGuard(
      { id: 'd1', nombre: 'Puerta', tipo: 'ENTRADAS', activo: true, revokedAt: null },
      'pos',
    );
    const { context } = makeContext(`Bearer ${token}`);
    try {
      await guard.canActivate(context as never);
      fail('debió rechazar con 403');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'DEVICE_WRONG_MODE' });
    }
  });

  it('dispositivo POS en ruta pos → pasa', async () => {
    const token = generateDeviceToken();
    const { guard } = makeGuard(
      { id: 'd2', nombre: 'Bufet', tipo: 'POS', activo: true, revokedAt: null },
      'pos',
    );
    const { context, request } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.device.tipo).toBe('POS');
  });
});

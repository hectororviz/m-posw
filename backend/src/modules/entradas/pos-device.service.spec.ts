import { ServiceUnavailableException } from '@nestjs/common';
import { PosDeviceService } from './pos-device.service';

function makeService(setting: any, user: any) {
  const prisma: any = {
    setting: { findFirst: jest.fn().mockResolvedValue(setting) },
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  };
  return new PosDeviceService(prisma as never);
}

describe('PosDeviceService.resolvePosUserId', () => {
  it('devuelve el userId configurado y activo', async () => {
    const service = makeService({ posDeviceUserId: 'u1' }, { id: 'u1', active: true });
    await expect(service.resolvePosUserId()).resolves.toBe('u1');
  });

  it('sin setting → 503 POS_USER_NOT_CONFIGURED', async () => {
    const service = makeService({ posDeviceUserId: null }, null);
    try {
      await service.resolvePosUserId();
      fail('debió rechazar con 503');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      expect((e as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'POS_USER_NOT_CONFIGURED',
      });
    }
  });

  it('usuario inactivo → 503', async () => {
    const service = makeService({ posDeviceUserId: 'u1' }, { id: 'u1', active: false });
    await expect(service.resolvePosUserId()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

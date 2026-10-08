import { ServiceUnavailableException } from '@nestjs/common';
import { PosDeviceService } from './pos-device.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

function makeService(opts: {
  setting?: any;
  userById?: any;
  userByUsername?: any;
  createdUser?: any;
  failEnsure?: boolean;
}) {
  const prisma: any = {
    setting: {
      findFirst: jest.fn().mockResolvedValue(opts.setting ?? null),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...opts.setting, ...data })),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 's1', ...data })),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.id) return opts.userById ?? null;
        if (where.username) return opts.userByUsername ?? null;
        return null;
      }),
      create: jest.fn().mockImplementation(async () => {
        if (opts.failEnsure) throw new Error('db down');
        return opts.createdUser ?? { id: 'u-pos', active: true };
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'u-pos', ...data })),
    },
    userModulePermission: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new PosDeviceService(prisma as never);
  return { service, prisma };
}

describe('PosDeviceService.resolvePosUserId', () => {
  it('devuelve el userId configurado y activo', async () => {
    const { service, prisma } = makeService({
      setting: { id: 's1', posDeviceUserId: 'u1' },
      userById: { id: 'u1', active: true },
    });
    await expect(service.resolvePosUserId()).resolves.toBe('u1');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('sin vínculo en Setting → auto-crea en vez de 503', async () => {
    const { service } = makeService({
      setting: { id: 's1', posDeviceUserId: null },
      userByUsername: null,
      createdUser: { id: 'u-pos', active: true },
    });
    await expect(service.resolvePosUserId()).resolves.toBe('u-pos');
  });

  it('usuario inactivo → reactiva automáticamente', async () => {
    const { service, prisma } = makeService({
      setting: { id: 's1', posDeviceUserId: 'u-pos' },
      userById: { id: 'u-pos', active: false },
      userByUsername: { id: 'u-pos', active: false },
    });
    await expect(service.resolvePosUserId()).resolves.toBe('u-pos');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } }),
    );
  });

  it('si el auto-ensure falla → 503 POS_USER_NOT_CONFIGURED', async () => {
    const { service } = makeService({
      setting: { id: 's1', posDeviceUserId: null },
      userByUsername: null,
      failEnsure: true,
    });
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
});

describe('PosDeviceService.ensurePosTerminalUser', () => {
  it('es idempotente cuando todo ya existe', async () => {
    const { service, prisma } = makeService({
      setting: { id: 's1', posDeviceUserId: 'u-pos' },
      userByUsername: { id: 'u-pos', active: true },
    });
    await expect(service.ensurePosTerminalUser()).resolves.toBe('u-pos');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

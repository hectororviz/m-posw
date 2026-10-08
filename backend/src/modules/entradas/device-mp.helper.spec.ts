import { BadRequestException } from '@nestjs/common';
import { resolveDeviceMpOrThrow } from './device-mp.helper';

describe('resolveDeviceMpOrThrow', () => {
  it('devuelve externals del device vinculado', async () => {
    const prisma: any = {
      posDevice: {
        findUnique: jest.fn().mockResolvedValue({
          mpExternalStoreId: 'store-1',
          mpExternalPosId: 'pos-9',
        }),
      },
    };
    await expect(resolveDeviceMpOrThrow(prisma as never, 'd1')).resolves.toEqual({
      externalStoreId: 'store-1',
      externalPosId: 'pos-9',
    });
  });

  it('sin vincular → 400 MP_POS_NOT_LINKED', async () => {
    const prisma: any = {
      posDevice: { findUnique: jest.fn().mockResolvedValue({ mpExternalStoreId: null, mpExternalPosId: null }) },
    };
    try {
      await resolveDeviceMpOrThrow(prisma as never, 'd1');
      fail('debió rechazar con 400');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'MP_POS_NOT_LINKED' });
    }
  });

  it('device inexistente → 400 MP_POS_NOT_LINKED', async () => {
    const prisma: any = { posDevice: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(resolveDeviceMpOrThrow(prisma as never, 'nope')).rejects.toBeInstanceOf(BadRequestException);
  });
});

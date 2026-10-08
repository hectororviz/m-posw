import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface DeviceMpConfig {
  externalStoreId: string;
  externalPosId: string;
}

/**
 * POS de MP propio de un dispositivo. Sin vincular no hay QR:
 * MP_QR exige MP específico (sin fallback, evita colisiones en MP).
 */
export async function resolveDeviceMpOrThrow(
  prisma: PrismaService,
  deviceId: string,
): Promise<DeviceMpConfig> {
  const device = await prisma.posDevice.findUnique({
    where: { id: deviceId },
    select: { mpExternalStoreId: true, mpExternalPosId: true },
  });
  if (!device?.mpExternalStoreId || !device?.mpExternalPosId) {
    throw new BadRequestException({
      code: 'MP_POS_NOT_LINKED',
      message: 'Terminal sin POS de Mercado Pago vinculado',
    });
  }
  return { externalStoreId: device.mpExternalStoreId, externalPosId: device.mpExternalPosId };
}

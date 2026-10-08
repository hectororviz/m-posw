import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Resuelve el usuario genérico al que se atribuyen las ventas de
 * terminales POS (auth por token de dispositivo, sin JWT).
 */
@Injectable()
export class PosDeviceService {
  private readonly logger = new Logger(PosDeviceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolvePosUserId(): Promise<string> {
    const setting = await this.prisma.setting.findFirst({ select: { posDeviceUserId: true } });
    if (!setting?.posDeviceUserId) {
      throw new ServiceUnavailableException({
        code: 'POS_USER_NOT_CONFIGURED',
        message: 'Terminal POS sin usuario atribuido (correr seed)',
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: setting.posDeviceUserId },
      select: { id: true, active: true },
    });
    if (!user || !user.active) {
      this.logger.warn(`posDeviceUserId=${setting.posDeviceUserId} inexistente o inactivo`);
      throw new ServiceUnavailableException({
        code: 'POS_USER_NOT_CONFIGURED',
        message: 'Usuario de terminales POS inexistente o inactivo',
      });
    }
    return user.id;
  }
}

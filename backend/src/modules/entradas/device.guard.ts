import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { extractBearerToken, hashDeviceToken } from './device-token.util';

export interface EntradasDeviceContext {
  id: string;
  nombre: string;
}

/**
 * Autentica terminales POS externos por token largo (ent_...) revocable.
 * No usa JWT de usuarios: el POS opera fuera del VPS con este Bearer.
 */
@Injectable()
export class EntradasDeviceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException({ code: 'DEVICE_TOKEN_MISSING', message: 'Token de dispositivo requerido' });
    }
    const device = await this.prisma.posDevice.findUnique({
      where: { tokenHash: hashDeviceToken(token) },
      select: { id: true, nombre: true, activo: true, revokedAt: true },
    });
    if (!device || !device.activo || device.revokedAt) {
      throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'Dispositivo no autorizado o revocado' });
    }
    request.entradasDevice = { id: device.id, nombre: device.nombre } as EntradasDeviceContext;
    await this.prisma.posDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => undefined);
    return true;
  }
}

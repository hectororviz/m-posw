import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { UserPermissionsService } from '../users/user-permissions.service';
import { DEVICE_TOKEN_PREFIX, extractBearerToken, hashDeviceToken } from './device-token.util';

/**
 * Acepta JWT de usuario (con acceso ENTRADAS >= READ) o token de
 * dispositivo POS (ent_...). Para endpoints compartidos web + POS
 * (template del ticket y escudo) donde la ruta es la misma.
 */
@Injectable()
export class EntradasFlexibleGuard implements CanActivate {
  private readonly jwtGuard: JwtAuthGuard;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: UserPermissionsService,
  ) {
    this.jwtGuard = new JwtAuthGuard();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);
    if (token?.startsWith(DEVICE_TOKEN_PREFIX)) {
      const device = await this.prisma.posDevice.findUnique({
        where: { tokenHash: hashDeviceToken(token) },
        select: { id: true, nombre: true, activo: true, revokedAt: true },
      });
      if (!device || !device.activo || device.revokedAt) {
        throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'Dispositivo no autorizado o revocado' });
      }
      request.entradasDevice = { id: device.id, nombre: device.nombre };
      await this.prisma.posDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => undefined);
      return true;
    }
    const jwtOk = await this.jwtGuard.canActivate(context);
    if (!jwtOk) return false;
    const user = request.user;
    if (!user) return false;
    const access = await this.permissions.resolveAccess(user.sub ?? user.id, ModuleKey.ENTRADAS);
    return access === 'READ' || access === 'FULL';
  }
}

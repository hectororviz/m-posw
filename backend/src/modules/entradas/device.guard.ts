import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../common/prisma.service';
import { DEVICE_KIND_KEY, type DeviceKind } from './device-kind.decorator';
import { extractBearerToken, hashDeviceToken } from './device-token.util';

export interface DeviceContext {
  id: string;
  nombre: string;
  tipo: 'ENTRADAS' | 'POS';
}

/** Alias de compatibilidad: el código existente usa este nombre. */
export type EntradasDeviceContext = DeviceContext;

/**
 * Autentica terminales por token largo (ent_...) revocable.
 * No usa JWT de usuarios: la terminal opera fuera del VPS con este Bearer.
 * Con @DeviceKind('entradas'|'pos') además impone el alcance por tipo.
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException({ code: 'DEVICE_TOKEN_MISSING', message: 'Token de dispositivo requerido' });
    }
    const device = await this.prisma.posDevice.findUnique({
      where: { tokenHash: hashDeviceToken(token) },
      select: { id: true, nombre: true, tipo: true, activo: true, revokedAt: true },
    });
    if (!device || !device.activo || device.revokedAt) {
      throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'Dispositivo no autorizado o revocado' });
    }
    const required =
      this.reflector.getAllAndOverride<DeviceKind | undefined>(DEVICE_KIND_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? null;
    if (required && device.tipo !== required.toUpperCase()) {
      throw new ForbiddenException({
        code: 'DEVICE_WRONG_MODE',
        message: `Dispositivo configurado como ${device.tipo}, se requiere ${required}`,
      });
    }
    const ctx: DeviceContext = { id: device.id, nombre: device.nombre, tipo: device.tipo };
    request.device = ctx;
    // Alias de compatibilidad: el código existente lee request.entradasDevice
    request.entradasDevice = ctx;
    await this.prisma.posDevice
      .update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);
    return true;
  }
}

/** Alias de compatibilidad: el código existente usa este nombre. */
export const EntradasDeviceGuard = DeviceGuard;

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DeviceGuard, type DeviceContext } from './device.guard';

/**
 * Identidad del propio dispositivo. Sin @DeviceKind a propósito:
 * cualquier token válido puede consultar su tipo. El modo nunca se
 * confía al cliente ni al contenido del QR.
 */
@Controller('entradas/devices')
@UseGuards(DeviceGuard)
export class DeviceMeController {
  @Get('me')
  me(@Req() req: Request) {
    const device = (req as unknown as { device: DeviceContext }).device;
    return { id: device.id, nombre: device.nombre, tipo: device.tipo, activo: true };
  }
}

import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DeviceGuard, type DeviceContext } from './device.guard';
import { EntradasBeneficiosService } from './entradas-beneficios.service';
import { EntradasSalesService } from './entradas-sales.service';

/**
 * Lookups por token de dispositivo sin restricción de modo.
 * Cualquier terminal válida (ENTRADAS o POS) puede resolver un QR:
 * sea carnet de socio o beneficio de entrada, el mecanismo es el mismo.
 */
@Controller('entradas')
@UseGuards(DeviceGuard)
export class DeviceLookupController {
  constructor(
    private readonly sales: EntradasSalesService,
    private readonly beneficios: EntradasBeneficiosService,
  ) {}

  private device(req: Request): DeviceContext {
    return (req as unknown as { device: DeviceContext }).device;
  }

  // Escaneo QR de socio para descuentos.
  @Get('socios/:uuid')
  socio(@Param('uuid') uuid: string) {
    return this.sales.resolveSocioForDevice(uuid);
  }

  // Validación y consumo de beneficios de bufet.
  // Mismo contrato que la web (`ENT:<code>` o código pelado).
  @Get('beneficios/:code')
  validarBeneficio(@Param('code') code: string) {
    return this.beneficios.validate(code, 'POS_DEVICE');
  }

  @Post('beneficios/:code/consumir')
  consumirBeneficio(@Req() req: Request, @Param('code') code: string) {
    return this.beneficios.consume(code, { canal: 'POS_DEVICE', deviceId: this.device(req).id });
  }
}

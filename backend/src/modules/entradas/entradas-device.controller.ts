import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EntradasAdminService } from './entradas-admin.service';
import { EntradasSalesService } from './entradas-sales.service';
import { EntradasDeviceGuard, type EntradasDeviceContext } from './device.guard';
import { CreateIntentDto } from './dto/create-intent.dto';

/**
 * API del terminal POS externo. Auth por token de dispositivo (Bearer ent_...).
 * Pensada para llamarse desde fuera del VPS por HTTPS (vía Caddy → /api/).
 */
@Controller('entradas')
@UseGuards(EntradasDeviceGuard)
export class EntradasDeviceController {
  constructor(private readonly sales: EntradasSalesService) {}

  private device(req: Request): EntradasDeviceContext {
    return (req as unknown as { entradasDevice: EntradasDeviceContext }).entradasDevice;
  }

  @Get('fixtures/vigentes')
  vigentes() {
    return this.sales.vigentes();
  }

  // Alias para compatibilidad con el contrato v1
  @Get('fixtures/hoy')
  hoy() {
    return this.sales.vigentes();
  }

  @Post('sales/intent')
  intent(@Req() req: Request, @Body() dto: CreateIntentDto, @Headers('x-request-id') requestId?: string) {
    return this.sales.createIntent(this.device(req), dto, requestId || undefined).then(async (payload) => {
      await this.sales.expireOldPending().catch(() => 0);
      return payload;
    });
  }

  @Get('sales/:id/status')
  saleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.sales.status(id, this.device(req)).then(async (payload) => {
      await this.sales.expireOldPending().catch(() => 0);
      return payload;
    });
  }

  @Post('sales/:id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.sales.cancel(id, this.device(req));
  }

  // (GET ticket-template y ticket-assets/escudo viven en
  // EntradasSharedController: misma ruta para JWT y device token)

  // Reservado futuro: escaneo QR de socio para descuentos. Implementado pero sin uso en prueba.
  @Get('socios/:uuid')
  socio(@Param('uuid') uuid: string) {
    return this.sales.resolveSocioForDevice(uuid);
  }
}

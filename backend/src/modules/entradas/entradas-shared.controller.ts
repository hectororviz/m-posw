import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EntradasAdminService } from './entradas-admin.service';
import { EntradasFlexibleGuard } from './entradas-flexible.guard';

/**
 * Endpoints con la misma ruta para web-admin (JWT) y POS (device token).
 * El guard acepta cualquiera de los dos.
 */
@Controller('entradas')
@UseGuards(EntradasFlexibleGuard)
export class EntradasSharedController {
  constructor(private readonly admin: EntradasAdminService) {}

  @Get('ticket-template')
  template(@Query('id') id?: string) {
    return this.admin.getTemplate(id);
  }

  @Get('ticket-assets/escudo')
  escudo() {
    return this.admin.getEscudo();
  }
}

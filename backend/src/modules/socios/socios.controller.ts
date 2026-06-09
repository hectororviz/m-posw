import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateSocioTipoDto } from './dto/create-socio-tipo.dto';
import { UpdateSocioTipoDto } from './dto/update-socio-tipo.dto';
import { CreateSocioDto } from './dto/create-socio.dto';
import { UpdateSocioDto } from './dto/update-socio.dto';
import { CreateSocioPagoDto } from './dto/create-socio-pago.dto';
import { GenerarCuotasDto } from './dto/generar-cuotas.dto';
import { SociosService } from './socios.service';
import type { Response } from 'express';

@Controller('socios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  // ─── Tipos ───────────────────────────────────────────────

  @Get('tipos')
  getTipos() {
    return this.sociosService.getTipos();
  }

  @Post('tipos')
  createTipo(@Body() dto: CreateSocioTipoDto) {
    return this.sociosService.createTipo(dto);
  }

  @Put('tipos/:id')
  updateTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSocioTipoDto,
  ) {
    return this.sociosService.updateTipo(id, dto);
  }

  @Delete('tipos/:id')
  deleteTipo(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.deleteTipo(id);
  }

  // ─── Socios ──────────────────────────────────────────────

  @Get()
  findAll(
    @Query('estado') estado?: string,
    @Query('socioTipoId') socioTipoId?: string,
    @Query('deuda') deuda?: string,
  ) {
    return this.sociosService.findAll({ estado, socioTipoId, deuda });
  }

  @Get('tesoreria/resumen')
  getTesoreríaResumen() {
    return this.sociosService.getTesoreríaResumen();
  }

  @Get('cuotas/generar')
  generarCuotasGet() {
    return { mensaje: 'Usa POST /api/socios/cuotas/generar con { anio, mes }' };
  }

  @Post('cuotas/generar')
  generarCuotas(@Body() dto: GenerarCuotasDto) {
    return this.sociosService.generarCuotas(dto);
  }

  @Get('reporte/matriz')
  getMatriz(@Query('anio', ParseIntPipe) anio: number) {
    return this.sociosService.getMatriz(anio);
  }

  @Post()
  create(@Body() dto: CreateSocioDto) {
    return this.sociosService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSocioDto,
  ) {
    return this.sociosService.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.deactivate(id);
  }

  // ─── Cuotas del socio ────────────────────────────────────

  @Get(':id/cuotas')
  getCuotasSocio(@Param('id', ParseIntPipe) id: number) {
    return this.sociosService.getCuotasSocio(id);
  }

  @Post('cuotas/:cuotaId/pagar')
  pagarCuota(
    @Param('cuotaId', ParseIntPipe) cuotaId: number,
    @Body() dto: CreateSocioPagoDto,
  ) {
    return this.sociosService.pagarCuota(cuotaId, dto);
  }

  // ─── Carnet ──────────────────────────────────────────────

  @Get(':id/carnet')
  async getCarnet(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.sociosService.generateCarnetPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}

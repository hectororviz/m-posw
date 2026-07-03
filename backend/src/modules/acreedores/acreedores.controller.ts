import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { AcreedoresService } from './acreedores.service';
import { CreateAcreedorDto } from './dto/create-acreedor.dto';
import { UpdateAcreedorDto } from './dto/update-acreedor.dto';
import { CreatePagoDto } from './dto/create-pago.dto';
import { CreateAjusteDto } from './dto/create-ajuste.dto';

@Controller('acreedores')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AcreedoresController {
  constructor(private readonly acreedoresService: AcreedoresService) {}

  @Get('resumen')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.READ)
  getResumen() {
    return this.acreedoresService.getResumen();
  }

  @Get()
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.READ)
  findAll() {
    return this.acreedoresService.findAll();
  }

  @Get(':id')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.findOne(id);
  }

  @Post()
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.FULL)
  create(@Body() dto: CreateAcreedorDto) {
    return this.acreedoresService.create(dto);
  }

  @Patch(':id')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.FULL)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAcreedorDto,
  ) {
    return this.acreedoresService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.FULL)
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.toggleActive(id);
  }

  @Get(':id/deuda')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.READ)
  getDeuda(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.getDeuda(id);
  }

  @Post(':id/pagos')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.FULL)
  addPago(
    @Req() req: { user: { sub: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePagoDto,
  ) {
    return this.acreedoresService.addPago(req.user.sub, id, dto);
  }

  @Post(':id/ajustes')
  @RequireModule(ModuleKey.ACREEDORES, ModuleAccess.FULL)
  addAjuste(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAjusteDto,
  ) {
    return this.acreedoresService.addAjuste(id, dto);
  }
}

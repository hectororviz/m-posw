import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AcreedoresService } from './acreedores.service';
import { CreateAcreedorDto } from './dto/create-acreedor.dto';
import { UpdateAcreedorDto } from './dto/update-acreedor.dto';
import { CreatePagoDto } from './dto/create-pago.dto';

@Controller('acreedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AcreedoresController {
  constructor(private readonly acreedoresService: AcreedoresService) {}

  @Get('resumen')
  getResumen() {
    return this.acreedoresService.getResumen();
  }

  @Get()
  findAll() {
    return this.acreedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAcreedorDto) {
    return this.acreedoresService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAcreedorDto,
  ) {
    return this.acreedoresService.update(id, dto);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.toggleActive(id);
  }

  @Get(':id/deuda')
  getDeuda(@Param('id', ParseIntPipe) id: number) {
    return this.acreedoresService.getDeuda(id);
  }

  @Post(':id/pagos')
  addPago(
    @Req() req: { user: { sub: string } },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePagoDto,
  ) {
    return this.acreedoresService.addPago(req.user.sub, id, dto);
  }
}

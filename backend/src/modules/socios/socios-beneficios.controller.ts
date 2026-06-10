import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateBeneficioDto } from './dto/create-beneficio.dto';
import { UpdateBeneficioDto } from './dto/update-beneficio.dto';
import { CreateCanjesDto } from './dto/create-canjes.dto';
import { SociosBeneficiosService } from './socios-beneficios.service';

@Controller('socios/beneficios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SociosBeneficiosController {
  constructor(private readonly beneficiosService: SociosBeneficiosService) {}

  @Get()
  findAll(@Query('socioTipoId') socioTipoId?: string) {
    return this.beneficiosService.findAll(socioTipoId);
  }

  @Post()
  create(@Body() dto: CreateBeneficioDto) {
    return this.beneficiosService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBeneficioDto) {
    return this.beneficiosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.beneficiosService.remove(id);
  }
}

@Controller('socios/canjes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.USER)
export class SociosCanjesController {
  constructor(private readonly beneficiosService: SociosBeneficiosService) {}

  @Post()
  create(@Body() dto: CreateCanjesDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const posId = req.user?.externalPosId || req.user?.posId;
    return this.beneficiosService.registerCanjes(dto, userId, posId);
  }
}

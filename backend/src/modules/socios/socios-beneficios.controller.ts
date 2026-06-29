import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreateBeneficioDto } from './dto/create-beneficio.dto';
import { UpdateBeneficioDto } from './dto/update-beneficio.dto';
import { CreateCanjesDto } from './dto/create-canjes.dto';
import { SociosBeneficiosService } from './socios-beneficios.service';

@Controller('socios/beneficios')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.SOCIOS, ModuleAccess.READ)
export class SociosBeneficiosController {
  constructor(private readonly beneficiosService: SociosBeneficiosService) {}

  @Get()
  findAll(@Query('socioTipoId') socioTipoId?: string) {
    return this.beneficiosService.findAll(socioTipoId);
  }

  @Post()
  @RequireModule(ModuleKey.SOCIOS, ModuleAccess.FULL)
  create(@Body() dto: CreateBeneficioDto) {
    return this.beneficiosService.create(dto);
  }

  @Put(':id')
  @RequireModule(ModuleKey.SOCIOS, ModuleAccess.FULL)
  update(@Param('id') id: string, @Body() dto: UpdateBeneficioDto) {
    return this.beneficiosService.update(id, dto);
  }

  @Delete(':id')
  @RequireModule(ModuleKey.SOCIOS, ModuleAccess.FULL)
  remove(@Param('id') id: string) {
    return this.beneficiosService.remove(id);
  }
}

@Controller('socios/canjes')
@UseGuards(JwtAuthGuard)
export class SociosCanjesController {
  constructor(private readonly beneficiosService: SociosBeneficiosService) {}

  @Post()
  create(@Body() dto: CreateCanjesDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const posId = req.user?.externalPosId || req.user?.posId;
    return this.beneficiosService.registerCanjes(dto, userId, posId);
  }
}

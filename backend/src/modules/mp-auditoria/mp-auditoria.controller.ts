import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { MpAuditoriaService } from './mp-auditoria.service';
import { CategorizarDto, ListMpMovementsDto, SyncDto, VincularDto } from './dto/mp-auditoria.dto';

@Controller('mp-auditoria')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class MpAuditoriaController {
  constructor(private readonly service: MpAuditoriaService) {}

  @Get()
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  list(@Query() query: ListMpMovementsDto) {
    return this.service.list(query);
  }

  @Get('status')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  status() {
    return this.service.syncStatus();
  }

  @Get('balance')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  balance() {
    return this.service.balance();
  }

  @Get(':id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Post('sync')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  sync() {
    return this.service.syncIncremental();
  }

  @Post('backfill')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  backfill(@Body() dto: SyncDto) {
    return this.service.backfill(dto?.from);
  }

  @Post('reconciliar')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  reconciliar() {
    return this.service.reconcileAll();
  }

  @Post(':id/vincular')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  vincular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VincularDto, @Req() req: { user?: { sub?: string; id?: string } }) {
    return this.service.vincular(id, dto, req.user?.sub ?? req.user?.id);
  }

  @Post(':id/categorizar')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  categorizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategorizarDto, @Req() req: { user?: { sub?: string; id?: string } }) {
    return this.service.categorizar(id, dto, req.user?.sub ?? req.user?.id);
  }

  @Post(':id/ignorar')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  ignorar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.ignorar(id);
  }

  @Post(':id/desvincular')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  desvincular(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.desvincular(id);
  }
}

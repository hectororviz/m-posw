import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { MAX_IMAGE_BYTES } from '../common/upload.constants';
import { EntradasAdminService } from './entradas-admin.service';
import { CreateFixtureDto, UpdateFixtureDto } from './dto/create-fixture.dto';
import { CreateRivalDto } from './dto/create-rival.dto';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { SelectEntradasPosDto, SetupEntradasPosDto } from './dto/mp-pos.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('entradas')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.ENTRADAS, ModuleAccess.READ)
export class EntradasAdminController {
  constructor(private readonly admin: EntradasAdminService) {}

  // ── Torneos ──
  @Get('torneos')
  torneos() {
    return this.admin.listTorneos();
  }

  @Post('torneos')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  createTorneo(@Body() dto: CreateTorneoDto) {
    return this.admin.createTorneo(dto);
  }

  @Patch('torneos/:id')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  updateTorneo(@Param('id') id: string, @Body() dto: Partial<CreateTorneoDto>) {
    return this.admin.updateTorneo(id, dto);
  }

  // ── Rivales ──
  @Get('rivales')
  rivales() {
    return this.admin.listRivales();
  }

  @Post('rivales')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  createRival(@Body() dto: CreateRivalDto) {
    return this.admin.createRival(dto);
  }

  @Patch('rivales/:id')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  updateRival(@Param('id') id: string, @Body() dto: Partial<CreateRivalDto>) {
    return this.admin.updateRival(id, dto);
  }

  // ── Fixtures ──
  @Get('fixtures')
  fixtures(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.listFixtures(from, to);
  }

  @Post('fixtures')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  createFixture(@Body() dto: CreateFixtureDto) {
    return this.admin.createFixture(dto);
  }

  @Patch('fixtures/:id')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  updateFixture(@Param('id') id: string, @Body() dto: UpdateFixtureDto) {
    return this.admin.updateFixture(id, dto);
  }

  // ── Dispositivos ──
  @Get('devices')
  devices() {
    return this.admin.listDevices();
  }

  @Post('devices')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  createDevice(@Body() body: { nombre: string; baseUrl?: string }) {
    return this.admin.createDevice(body?.nombre).then((res) => ({
      ...res,
      pairing: EntradasAdminService.pairingPayload(body?.baseUrl ?? '', res.token),
    }));
  }

  @Post('devices/:id/revoke')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  revokeDevice(@Param('id') id: string) {
    return this.admin.revokeDevice(id);
  }

  @Post('devices/:id/rotate')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  rotateDevice(@Param('id') id: string, @Body() body: { baseUrl?: string }) {
    return this.admin.rotateDevice(id).then((res) => ({
      ...res,
      pairing: EntradasAdminService.pairingPayload(body?.baseUrl ?? '', res.token),
    }));
  }

  // ── POS Mercado Pago dedicado (nunca toca el principal) ──
  @Get('mp-pos')
  mpPosStatus() {
    return this.admin.mpPosStatus();
  }

  @Get('mp-pos/detect-stores')
  mpPosDetectStores() {
    return this.admin.mpPosDetectStores();
  }

  @Post('mp-pos/select')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  mpPosSelect(@Body() dto: SelectEntradasPosDto) {
    return this.admin.mpPosSelect(dto.storeId, dto.posId);
  }

  @Post('mp-pos/setup')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  mpPosSetup(@Body() dto: SetupEntradasPosDto) {
    return this.admin.mpPosSetup(dto);
  }

  @Post('mp-pos/disconnect')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  mpPosDisconnect() {
    return this.admin.mpPosDisconnect();
  }

  // ── Ventas ──
  @Get('sales')
  sales(@Query('fixtureId') fixtureId?: string, @Query('status') status?: string) {
    return this.admin.listSales(fixtureId, status);
  }

  @Get('sales/summary')
  salesSummary(@Query('fixtureId') fixtureId: string) {
    return this.admin.salesSummary(fixtureId);
  }

  // ── Template + escudo ──
  // (los GET viven en EntradasSharedController: misma ruta para JWT y device token)
  @Get('ticket-assets/escudo-info')
  escudoInfo() {
    return this.admin.getEscudo().then((row) => ({
      version: row.version,
      widthPx: row.widthPx,
      hasImage: !!row.pngBase64,
      updatedAt: row.updatedAt,
    }));
  }

  @Patch('ticket-template')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  updateTemplate(@Body() dto: UpdateTemplateDto) {
    return this.admin.updateTemplate(dto);
  }

  @Post('ticket-assets/escudo')
  @RequireModule(ModuleKey.ENTRADAS, ModuleAccess.FULL)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadEscudo(@UploadedFile() file: Express.Multer.File, @Body() body: { widthPx?: string }) {
    return this.admin.uploadEscudo(file, Number(body?.widthPx) || 256).then((row) => ({
      version: row.version,
      widthPx: row.widthPx,
      hasImage: !!row.pngBase64,
      updatedAt: row.updatedAt,
    }));
  }
}

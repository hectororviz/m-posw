import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoOauthService } from '../mercadopago-oauth/mercadopago-oauth.service';
import { EntradasAdminService } from './entradas-admin.service';
import { SelectEntradasPosDto, SetupEntradasPosDto } from './dto/mp-pos.dto';

/**
 * Administración de terminales (modo ENTRADAS o POS) + su POS de
 * Mercado Pago propio. Sin fallback: cada terminal con QR necesita
 * su MP vinculado (400 MP_POS_NOT_LINKED si no).
 */
@Controller('dispositivos')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.READ)
export class DispositivosController {
  constructor(
    private readonly admin: EntradasAdminService,
    private readonly prisma: PrismaService,
    private readonly mpOauth: MercadoPagoOauthService,
  ) {}

  @Get()
  devices() {
    return this.admin.listDevices();
  }

  @Post()
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  createDevice(@Body() body: { nombre: string; tipo?: string; baseUrl?: string }) {
    return this.admin.createDevice(body?.nombre, body?.tipo).then((res) => ({
      ...res,
      pairing: EntradasAdminService.pairingPayload(body?.baseUrl ?? '', res.token),
    }));
  }

  @Patch(':id/tipo')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  updateDeviceTipo(@Param('id') id: string, @Body() body: { tipo: string; force?: boolean }) {
    return this.admin.updateDeviceTipo(id, body?.tipo, body?.force === true);
  }

  @Post(':id/rotate')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  rotateDevice(@Param('id') id: string, @Body() body: { baseUrl?: string }) {
    return this.admin.rotateDevice(id).then((res) => ({
      ...res,
      pairing: EntradasAdminService.pairingPayload(body?.baseUrl ?? '', res.token),
    }));
  }

  @Post(':id/revoke')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  revokeDevice(@Param('id') id: string) {
    return this.admin.revokeDevice(id);
  }

  // ── POS de Mercado Pago por dispositivo ──────────────────
  @Get('mp-stores')
  async mpStores() {
    const [detected, setting, devices] = await Promise.all([
      this.mpOauth.listMpStores(),
      this.prisma.setting.findFirst({
        select: { mpStoreId: true, mpPosId: true, mpStoreName: true, mpPosName: true },
      }),
      this.prisma.posDevice.findMany({
        where: { revokedAt: null, mpPosId: { not: null } },
        select: { id: true, nombre: true, tipo: true, mpStoreId: true, mpPosId: true },
      }),
    ]);
    const used: { storeId: string | null; posId: string | null; usedBy: string }[] = [];
    if (setting?.mpStoreId && setting?.mpPosId) {
      used.push({
        storeId: setting.mpStoreId,
        posId: setting.mpPosId,
        usedBy: `Principal (${setting.mpStoreName ?? ''} / ${setting.mpPosName ?? ''})`,
      });
    }
    for (const d of devices) {
      used.push({ storeId: d.mpStoreId, posId: d.mpPosId, usedBy: `Terminal ${d.nombre}` });
    }
    return { stores: detected, used };
  }

  @Post(':id/mp-select')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  mpSelect(@Param('id') id: string, @Body() dto: SelectEntradasPosDto) {
    return this.mpOauth.selectStoreForDevice(id, dto.storeId, dto.posId);
  }

  @Post(':id/mp-setup')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  mpSetup(@Param('id') id: string, @Body() dto: SetupEntradasPosDto) {
    return this.mpOauth.setupPosForDevice(id, dto);
  }

  @Post(':id/mp-disconnect')
  @RequireModule(ModuleKey.CONFIGURACION, ModuleAccess.FULL)
  mpDisconnect(@Param('id') id: string) {
    return this.mpOauth.disconnectDeviceMp(id);
  }
}

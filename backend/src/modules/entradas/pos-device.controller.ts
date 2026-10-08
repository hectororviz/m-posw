import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { CreateCanjesDto } from '../socios/dto/create-canjes.dto';
import { SociosBeneficiosService } from '../socios/socios-beneficios.service';
import { SalesService } from '../sales/sales.service';
import { CreateCashSaleDto, CreateQrSaleDto } from '../sales/dto/create-sale.dto';
import { DeviceGuard, type DeviceContext } from './device.guard';
import { DeviceKind } from './device-kind.decorator';
import { PosDeviceService } from './pos-device.service';

/**
 * API del modo POS (bufet) en terminales con token de dispositivo.
 * Espejo mínimo de /sales + catálogo bajo @DeviceKind('pos'), sin JWT:
 * las ventas se atribuyen al usuario genérico pos-terminal.
 */
@Controller('pos-device')
@UseGuards(DeviceGuard)
@DeviceKind('pos')
export class PosDeviceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
    private readonly canjes: SociosBeneficiosService,
    private readonly posDevices: PosDeviceService,
  ) {}

  private device(req: Request): DeviceContext {
    return (req as unknown as { device: DeviceContext }).device;
  }

  private async requester() {
    const userId = await this.posDevices.resolvePosUserId();
    return { id: userId, role: 'USER' as const };
  }

  // ── Catálogo ─────────────────────────────────────────────
  @Get('catalog')
  async catalog() {
    const setting = await this.prisma.setting.findFirst({ select: { enableInternetModule: true } });
    const categories = (
      await this.prisma.category.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, iconName: true, colorHex: true, ticket: true },
      })
    ).filter((c) => setting?.enableInternetModule || c.name !== 'Internet');
    const products = await this.prisma.product.findMany({
      where: { active: true, type: { not: ProductType.RAW_MATERIAL } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        type: true,
        iconName: true,
        colorHex: true,
        categoryId: true,
        category: { select: { id: true, name: true, ticket: true } },
      },
    });
    return {
      categories,
      products: products.map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) })),
    };
  }

  // ── QR estático del POS principal ────────────────────────
  @Get('mp-qr')
  async mpQr() {
    const setting = await this.prisma.setting.findFirst({
      select: { mpQrData: true, mpLinked: true },
    });
    return { qrData: setting?.mpQrData ?? null, linked: setting?.mpLinked ?? false };
  }

  // ── Datos para el encabezado del ticket ──────────────────
  @Get('settings')
  async settings() {
    const setting = await this.prisma.setting.findFirst({
      select: { storeName: true, clubName: true },
    });
    return { storeName: setting?.storeName ?? '', clubName: setting?.clubName ?? '' };
  }

  // ── Ventas ───────────────────────────────────────────────
  @Post('sales/cash')
  async createCash(@Body() dto: CreateCashSaleDto) {
    return this.sales.createCashSale(await this.posDevices.resolvePosUserId(), dto);
  }

  @Post('sales/qr')
  async createQr(@Body() dto: CreateQrSaleDto) {
    return this.sales.createQrSale(await this.posDevices.resolvePosUserId(), dto);
  }

  @Get('sales/:id')
  async getSale(@Param('id') id: string) {
    // Incluye items + vouchers (la app reintenta 1.5s si los vouchers aún no están).
    return this.sales.getSaleById(id, await this.requester());
  }

  @Get('sales/:id/status')
  async getStatus(@Param('id') id: string) {
    return this.sales.getSaleStatus(id, await this.requester());
  }

  @Post('sales/:id/cancel')
  async cancel(@Param('id') id: string) {
    return this.sales.cancelQrSale(id, await this.requester());
  }

  @Post('sales/:id/ticket-printed')
  async ticketPrinted(@Param('id') id: string) {
    return this.sales.markTicketPrinted(id, await this.requester());
  }

  // ── Canjes de socio post-venta (no bloquea si falla, igual que la web) ──
  @Post('socios/canjes')
  async registerCanjes(@Req() req: Request, @Body() dto: CreateCanjesDto) {
    try {
      return await this.canjes.registerCanjes(dto, await this.posDevices.resolvePosUserId(), this.device(req).id);
    } catch {
      return { registered: false };
    }
  }
}

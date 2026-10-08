import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { AcreedoresService } from '../acreedores/acreedores.service';
import { CreateCanjesDto } from '../socios/dto/create-canjes.dto';
import { SociosBeneficiosService } from '../socios/socios-beneficios.service';
import { SalesService } from '../sales/sales.service';
import { CreateCashSaleDto, CreateFiadoSaleDto, CreateQrSaleDto } from '../sales/dto/create-sale.dto';
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
    private readonly acreedores: AcreedoresService,
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
        imagePath: true,
        imageUpdatedAt: true,
        categoryId: true,
        category: { select: { id: true, name: true, ticket: true } },
      },
    });
    return {
      categories,
      products: products.map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) })),
    };
  }

  // ── QR del POS propio del dispositivo (null = sin vincular, sin fallback) ──
  @Get('mp-qr')
  async mpQr(@Req() req: Request) {
    const device = await this.prisma.posDevice.findUnique({
      where: { id: this.device(req).id },
      select: { mpQrData: true, mpPosId: true },
    });
    return { qrData: device?.mpQrData ?? null, linked: !!device?.mpPosId };
  }

  // ── Ventas ───────────────────────────────────────────────
  @Post('sales/cash')
  async createCash(@Req() req: Request, @Body() dto: CreateCashSaleDto) {
    return this.sales.createCashSale(await this.posDevices.resolvePosUserId(), dto, this.device(req).id);
  }

  @Post('sales/qr')
  async createQr(@Req() req: Request, @Body() dto: CreateQrSaleDto) {
    return this.sales.createQrSale(await this.posDevices.resolvePosUserId(), dto, this.device(req).id);
  }

  @Post('sales/fiado')
  async createFiado(@Req() req: Request, @Body() dto: CreateFiadoSaleDto) {
    return this.sales.createFiadoSale(await this.posDevices.resolvePosUserId(), dto, this.device(req).id);
  }

  // ── Datos para el encabezado del ticket + métodos habilitados ──
  @Get('settings')
  async settings() {
    const setting = await this.prisma.setting.findFirst({
      select: {
        storeName: true,
        clubName: true,
        enableCashPayment: true,
        enableQrPayment: true,
        enableFiadoPayment: true,
        enableAcreedoresModule: true,
      },
    });
    // Transferencia discontinuada: no se expone ni se opera desde terminales.
    return {
      storeName: setting?.storeName ?? '',
      clubName: setting?.clubName ?? '',
      enableCashPayment: setting?.enableCashPayment ?? true,
      enableQrPayment: setting?.enableQrPayment ?? true,
      enableFiadoPayment: (setting?.enableFiadoPayment ?? false) && (setting?.enableAcreedoresModule ?? true),
    };
  }

  // ── Acreedores para fiado (mismas reglas que la web) ──────
  @Get('acreedores')
  async listAcreedores() {
    return this.acreedores.findAll();
  }

  // ── Ventas ───────────────────────────────────────────────
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

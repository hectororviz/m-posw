import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { CreateManualMovementDto } from './dto/create-manual-movement.dto';
import { CreateCashSaleDto, CreateFiadoSaleDto, CreateQrSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('cash')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  createCash(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashSaleDto) {
    return this.salesService.createCashSale(req.user.sub, dto);
  }

  @Post('qr')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  createQr(@Req() req: { user: { sub: string } }, @Body() dto: CreateQrSaleDto) {
    return this.salesService.createQrSale(req.user.sub, dto);
  }

  @Post('fiado')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  createFiado(@Req() req: { user: { sub: string } }, @Body() dto: CreateFiadoSaleDto) {
    return this.salesService.createFiadoSale(req.user.sub, dto);
  }

  @Get()
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.READ)
  list() {
    return this.salesService.listSales();
  }

  @Post('manual-movements')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  createManualMovement(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateManualMovementDto,
  ) {
    return this.salesService.createManualMovement(req.user.sub, dto);
  }

  @Get('manual-movements')
  @RequireModule(ModuleKey.VENTAS, ModuleAccess.READ)
  listManualMovements() {
    return this.salesService.listManualMovements();
  }

  @Get(':id')
  getById(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.getSaleById(id, { id: req.user.sub, role: req.user.role });
  }

  @Get(':id/status')
  getStatus(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.getSaleStatus(id, { id: req.user.sub, role: req.user.role });
  }

  @Get(':id/payment-status')
  getPaymentStatus(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    return this.salesService.getPaymentStatus(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/complete')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  completeSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.completeSale(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/cancel')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  cancelQrSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.cancelQrSale(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/ticket-printed')
  @RequireModule(ModuleKey.POS, ModuleAccess.FULL)
  markTicketPrinted(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.markTicketPrinted(id, { id: req.user.sub, role: req.user.role });
  }
}

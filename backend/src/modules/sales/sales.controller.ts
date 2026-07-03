import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateManualMovementDto } from './dto/create-manual-movement.dto';
import { CreateCashSaleDto, CreateFiadoSaleDto, CreateQrSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('cash')
  createCash(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashSaleDto) {
    return this.salesService.createCashSale(req.user.sub, dto);
  }

  @Post('qr')
  createQr(@Req() req: { user: { sub: string } }, @Body() dto: CreateQrSaleDto) {
    return this.salesService.createQrSale(req.user.sub, dto);
  }

  @Post('fiado')
  createFiado(@Req() req: { user: { sub: string } }, @Body() dto: CreateFiadoSaleDto) {
    return this.salesService.createFiadoSale(req.user.sub, dto);
  }

  @Get()
  list() {
    return this.salesService.listSales();
  }

  @Post('manual-movements')
  createManualMovement(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateManualMovementDto,
  ) {
    return this.salesService.createManualMovement(req.user.sub, dto);
  }

  @Get('manual-movements')
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
  completeSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.completeSale(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/cancel')
  cancelQrSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.cancelQrSale(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/ticket-printed')
  markTicketPrinted(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.markTicketPrinted(id, { id: req.user.sub, role: req.user.role });
  }
}

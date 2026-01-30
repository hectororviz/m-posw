import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateCashSaleDto, CreateQrSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('cash')
  @Roles(Role.ADMIN, Role.USER)
  createCash(@Req() req: { user: { sub: string } }, @Body() dto: CreateCashSaleDto) {
    return this.salesService.createCashSale(req.user.sub, dto);
  }

  @Post('qr')
  @Roles(Role.ADMIN, Role.USER)
  createQr(@Req() req: { user: { sub: string } }, @Body() dto: CreateQrSaleDto) {
    return this.salesService.createQrSale(req.user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.salesService.listSales();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER)
  getById(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.getSaleById(id, { id: req.user.sub, role: req.user.role });
  }

  @Get(':id/status')
  @Roles(Role.ADMIN, Role.USER)
  getStatus(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.getSaleStatus(id, { id: req.user.sub, role: req.user.role });
  }

  @Get(':id/payment-status')
  @Roles(Role.ADMIN, Role.USER)
  getPaymentStatus(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.getPaymentStatus(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/complete')
  @Roles(Role.ADMIN, Role.USER)
  completeSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.completeSale(id, { id: req.user.sub, role: req.user.role });
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.USER)
  cancelQrSale(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.cancelQrSale(id, { id: req.user.sub, role: req.user.role });
  }
}

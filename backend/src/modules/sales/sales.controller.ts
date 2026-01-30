import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.USER)
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateSaleDto) {
    return this.salesService.createSale(req.user.sub, dto);
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

  @Post(':id/payments/mercadopago-qr')
  @Roles(Role.ADMIN, Role.USER)
  startMercadoPagoPayment(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.startMercadoPagoPayment(
      id,
      { id: req.user.sub, sub: req.user.sub, role: req.user.role },
      'POST /sales/:id/payments/mercadopago-qr',
    );
  }

  @Post(':id/payments/mercadopago-qr/cancel')
  @Roles(Role.ADMIN, Role.USER)
  cancelMercadoPagoPayment(
    @Req() req: { user: { sub: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.salesService.cancelMercadoPagoPayment(
      id,
      { id: req.user.sub, sub: req.user.sub, role: req.user.role },
      'POST /sales/:id/payments/mercadopago-qr/cancel',
    );
  }
}

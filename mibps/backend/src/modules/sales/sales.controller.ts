import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateSaleDto) {
    return this.salesService.createSale(req.user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.salesService.listSales();
  }
}

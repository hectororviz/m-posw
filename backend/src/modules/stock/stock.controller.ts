import { Controller, Get, Patch, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @RequireModule(ModuleKey.PRODUCTOS, ModuleAccess.READ)
  async getStock() {
    return this.stockService.getStockGroupedByCategory();
  }

  @Patch(':productId')
  @RequireModule(ModuleKey.PRODUCTOS, ModuleAccess.FULL)
  async updateStock(
    @Param('productId') productId: string,
    @Body('stock') stock: number,
  ) {
    if (!Number.isFinite(stock) || stock < 0) {
      throw new BadRequestException('Stock inválido: debe ser >= 0');
    }
    return this.stockService.updateStock(productId, stock);
  }
}

import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  async getStock() {
    return this.stockService.getStockGroupedByCategory();
  }

  @Patch(':productId')
  async updateStock(
    @Param('productId') productId: string,
    @Body('stock') stock: number,
  ) {
    return this.stockService.updateStock(productId, stock);
  }
}

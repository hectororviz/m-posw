import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  controllers: [StockController],
  providers: [StockService, PrismaService],
})
export class StockModule {}

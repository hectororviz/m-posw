import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashMovementsController } from './cash-movements.controller';
import { CashMovementsService } from './cash-movements.service';

@Module({
  controllers: [CashMovementsController],
  providers: [CashMovementsService, PrismaService],
})
export class CashMovementsModule {}

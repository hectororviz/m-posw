import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';
import { CashMovementsController } from './cash-movements.controller';
import { CashMovementsService } from './cash-movements.service';

@Module({
  imports: [CashSessionsModule],
  controllers: [CashMovementsController],
  providers: [CashMovementsService, PrismaService],
})
export class CashMovementsModule {}

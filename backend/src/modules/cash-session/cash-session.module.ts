import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashSessionController } from './cash-session.controller';
import { CashSessionService } from './cash-session.service';

@Module({
  controllers: [CashSessionController],
  providers: [CashSessionService, PrismaService],
  exports: [CashSessionService],
})
export class CashSessionModule {}

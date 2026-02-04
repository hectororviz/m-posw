import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashSessionsController } from './cash-sessions.controller';
import { CashSessionsService } from './cash-sessions.service';

@Module({
  controllers: [CashSessionsController],
  providers: [CashSessionsService, PrismaService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}

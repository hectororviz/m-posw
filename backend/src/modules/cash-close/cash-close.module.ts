import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CashCloseController } from './cash-close.controller';
import { CashCloseService } from './cash-close.service';

@Module({
  controllers: [CashCloseController],
  providers: [CashCloseService, PrismaService],
  exports: [CashCloseService],
})
export class CashCloseModule {}

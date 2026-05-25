import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, PrismaService],
})
export class AccountingModule {}

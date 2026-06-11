import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TreasuryModule } from '../treasury/treasury.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [TreasuryModule],
  controllers: [AccountingController],
  providers: [AccountingService, PrismaService],
})
export class AccountingModule {}

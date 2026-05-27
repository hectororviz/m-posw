import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LedgerAccountsController } from './ledger-accounts.controller';
import { LedgerAccountsService } from './ledger-accounts.service';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { TreasuryReportsController } from './reports.controller';
import { TreasuryReportsService } from './reports.service';

@Module({
  controllers: [
    LedgerAccountsController,
    JournalEntriesController,
    TreasuryReportsController,
  ],
  providers: [
    PrismaService,
    LedgerAccountsService,
    JournalEntriesService,
    TreasuryReportsService,
  ],
})
export class TreasuryModule {}

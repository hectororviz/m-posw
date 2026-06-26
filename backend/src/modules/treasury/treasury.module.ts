import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LedgerAccountsController } from './ledger-accounts.controller';
import { LedgerAccountsService } from './ledger-accounts.service';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { TreasuryReportsController } from './reports.controller';
import { TreasuryReportsService } from './reports.service';
import { QuickExpenseController } from './quick-expense.controller';
import { QuickExpenseService } from './quick-expense.service';

@Module({
  controllers: [
    LedgerAccountsController,
    JournalEntriesController,
    TreasuryReportsController,
    QuickExpenseController,
  ],
  providers: [
    PrismaService,
    LedgerAccountsService,
    JournalEntriesService,
    TreasuryReportsService,
    QuickExpenseService,
  ],
  exports: [LedgerAccountsService, JournalEntriesService],
})
export class TreasuryModule {}

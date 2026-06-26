import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { DateRangeDto, LedgerAccountQueryDto } from './dto/report-query.dto';
import { TreasuryReportsService } from './reports.service';

@Controller('treasury/reports')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class TreasuryReportsController {
  constructor(private readonly service: TreasuryReportsService) {}

  @Get('summary')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  summary(@Query() query: DateRangeDto) {
    return this.service.summary(query.from, query.to);
  }

  @Get('ledger-book')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  ledgerBook(@Query() query: DateRangeDto) {
    return this.service.ledgerBook(query.from, query.to);
  }

  @Get('ledger-account')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  ledgerAccount(@Query() query: LedgerAccountQueryDto) {
    return this.service.ledgerAccount(query.accountId, query.from, query.to);
  }

  @Get('trial-balance')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  trialBalance(@Query() query: DateRangeDto) {
    return this.service.trialBalance(query.from, query.to);
  }

  @Get('income-statement')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  incomeStatement(@Query() query: DateRangeDto) {
    return this.service.incomeStatement(query.from, query.to);
  }

  @Get('availabilities')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  availabilities(@Query('asOf') asOf?: string) {
    return this.service.availabilityBalances(asOf);
  }

  @Get('export/ledger-book')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  async exportLedgerBook(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportLedgerBook(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=libro-diario.xlsx');
    res.send(buffer);
  }

  @Get('export/ledger-account')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  async exportLedgerAccount(@Query() query: LedgerAccountQueryDto, @Res() res: Response) {
    const buffer = await this.service.exportLedgerAccount(query.accountId, query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mayor-contable.xlsx');
    res.send(buffer);
  }

  @Get('export/trial-balance')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  async exportTrialBalance(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportTrialBalance(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=balance-sumas-saldos.xlsx');
    res.send(buffer);
  }

  @Get('export/income-statement')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  async exportIncomeStatement(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportIncomeStatement(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=estado-resultados.xlsx');
    res.send(buffer);
  }

  @Get('export/availabilities')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
  async exportAvailabilities(@Query('asOf') asOf: string, @Res() res: Response) {
    const buffer = await this.service.exportAvailabilityBalances(asOf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=disponibilidades.xlsx');
    res.send(buffer);
  }
}

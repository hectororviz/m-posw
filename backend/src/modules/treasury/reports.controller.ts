import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { DateRangeDto, LedgerAccountQueryDto } from './dto/report-query.dto';
import { TreasuryReportsService } from './reports.service';

@Controller('treasury/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TreasuryReportsController {
  constructor(private readonly service: TreasuryReportsService) {}

  @Get('summary')
  summary(@Query() query: DateRangeDto) {
    return this.service.summary(query.from, query.to);
  }

  @Get('ledger-book')
  ledgerBook(@Query() query: DateRangeDto) {
    return this.service.ledgerBook(query.from, query.to);
  }

  @Get('ledger-account')
  ledgerAccount(@Query() query: LedgerAccountQueryDto) {
    return this.service.ledgerAccount(query.accountId, query.from, query.to);
  }

  @Get('trial-balance')
  trialBalance(@Query() query: DateRangeDto) {
    return this.service.trialBalance(query.from, query.to);
  }

  @Get('income-statement')
  incomeStatement(@Query() query: DateRangeDto) {
    return this.service.incomeStatement(query.from, query.to);
  }

  @Get('availabilities')
  availabilities(@Query('asOf') asOf?: string) {
    return this.service.availabilityBalances(asOf);
  }

  @Get('export/ledger-book')
  async exportLedgerBook(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportLedgerBook(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=libro-diario.xlsx');
    res.send(buffer);
  }

  @Get('export/ledger-account')
  async exportLedgerAccount(@Query() query: LedgerAccountQueryDto, @Res() res: Response) {
    const buffer = await this.service.exportLedgerAccount(query.accountId, query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mayor-contable.xlsx');
    res.send(buffer);
  }

  @Get('export/trial-balance')
  async exportTrialBalance(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportTrialBalance(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=balance-sumas-saldos.xlsx');
    res.send(buffer);
  }

  @Get('export/income-statement')
  async exportIncomeStatement(@Query() query: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportIncomeStatement(query.from, query.to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=estado-resultados.xlsx');
    res.send(buffer);
  }

  @Get('export/availabilities')
  async exportAvailabilities(@Query('asOf') asOf: string, @Res() res: Response) {
    const buffer = await this.service.exportAvailabilityBalances(asOf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=disponibilidades.xlsx');
    res.send(buffer);
  }
}

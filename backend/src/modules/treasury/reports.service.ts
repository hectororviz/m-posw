import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerAccountType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TreasuryReportsService {
  constructor(private prisma: PrismaService) {}

  private buildDateFilter(from?: string, to?: string): any {
    const filter: any = {};
    if (from) filter.gte = new Date(from);
    if (to) filter.lte = new Date(to);
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  async ledgerBook(from?: string, to?: string) {
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        entry: {
          status: 'POSTED',
          date: this.buildDateFilter(from, to),
        },
      },
      include: {
        entry: true,
        account: true,
      },
      orderBy: [{ entry: { date: 'asc' } }, { entry: { entryNumber: 'asc' } }],
    });

    return lines.map((l) => ({
      entryNumber: l.entry.entryNumber,
      date: l.entry.date,
      description: l.entry.description,
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: Number(l.debit),
      credit: Number(l.credit),
      status: l.entry.status,
    }));
  }

  async ledgerAccount(accountId: string, from?: string, to?: string) {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new BadRequestException('Cuenta no encontrada');

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        entry: {
          status: 'POSTED',
          date: this.buildDateFilter(from, to),
        },
      },
      include: {
        entry: true,
        account: true,
      },
      orderBy: [{ entry: { date: 'asc' } }, { entry: { entryNumber: 'asc' } }],
    });

    let balance = 0;
    const isDebitNature = account.type === 'ASSET' || account.type === 'EXPENSE';

    const rows = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      if (isDebitNature) {
        balance += debit - credit;
      } else {
        balance += credit - debit;
      }
      return {
        date: l.entry.date,
        entryNumber: l.entry.entryNumber,
        description: l.entry.description,
        debit,
        credit,
        balance: Math.round(balance * 100) / 100,
      };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, type: account.type },
      isDebitNature,
      rows,
      finalBalance: Math.round(balance * 100) / 100,
    };
  }

  async trialBalance(from?: string, to?: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { acceptsEntries: true, active: true },
      orderBy: { code: 'asc' },
    });

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        entry: {
          status: 'POSTED',
          date: this.buildDateFilter(from, to),
        },
      },
      include: { account: true },
    });

    const grouped = new Map<string, { account: any; totalDebit: number; totalCredit: number }>();

    for (const line of lines) {
      const acc = grouped.get(line.accountId) || {
        account: line.account,
        totalDebit: 0,
        totalCredit: 0,
      };
      acc.totalDebit += Number(line.debit);
      acc.totalCredit += Number(line.credit);
      grouped.set(line.accountId, acc);
    }

    const result = accounts.map((a) => {
      const data = grouped.get(a.id) || { account: a, totalDebit: 0, totalCredit: 0 };
      const totalDebit = Math.round(data.totalDebit * 100) / 100;
      const totalCredit = Math.round(data.totalCredit * 100) / 100;

      const isDebitNature = a.type === 'ASSET' || a.type === 'EXPENSE';
      let debitBalance = 0;
      let creditBalance = 0;

      const net = isDebitNature
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

      if (net > 0) {
        if (isDebitNature) debitBalance = Math.round(net * 100) / 100;
        else creditBalance = Math.round(net * 100) / 100;
      } else if (net < 0) {
        if (isDebitNature) creditBalance = Math.round(-net * 100) / 100;
        else debitBalance = Math.round(-net * 100) / 100;
      }

      return {
        code: a.code,
        name: a.name,
        type: a.type,
        totalDebit,
        totalCredit,
        debitBalance,
        creditBalance,
      };
    });

    const totals = result.reduce(
      (acc, r) => ({
        totalDebit: acc.totalDebit + r.totalDebit,
        totalCredit: acc.totalCredit + r.totalCredit,
        debitBalance: acc.debitBalance + r.debitBalance,
        creditBalance: acc.creditBalance + r.creditBalance,
      }),
      { totalDebit: 0, totalCredit: 0, debitBalance: 0, creditBalance: 0 },
    );

    return { rows: result, totals };
  }

  async incomeStatement(from?: string, to?: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        type: { in: ['REVENUE', 'EXPENSE'] },
        acceptsEntries: true,
        active: true,
      },
      orderBy: { code: 'asc' },
    });

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        entry: {
          status: 'POSTED',
          date: this.buildDateFilter(from, to),
        },
      },
      include: { account: true },
    });

    const grouped = new Map<string, { account: any; debit: number; credit: number }>();

    for (const line of lines) {
      const acc = grouped.get(line.accountId) || {
        account: line.account,
        debit: 0,
        credit: 0,
      };
      acc.debit += Number(line.debit);
      acc.credit += Number(line.credit);
      grouped.set(line.accountId, acc);
    }

    const revenueRows: any[] = [];
    const expenseRows: any[] = [];
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const a of accounts) {
      const data = grouped.get(a.id);
      if (!data && (!a.type || a.type === 'REVENUE' || a.type === 'EXPENSE')) {
        continue; // skip accounts with no movement in period
      }
      if (!data) continue; // skip empty accounts

      const amount =
        a.type === 'REVENUE'
          ? Math.round((data.credit - data.debit) * 100) / 100
          : Math.round((data.debit - data.credit) * 100) / 100;

      const row = {
        code: a.code,
        name: a.name,
        amount: Math.abs(amount),
      };

      if (a.type === 'REVENUE') {
        revenueRows.push(row);
        if (amount > 0) totalRevenue += amount;
      } else {
        expenseRows.push(row);
        if (amount > 0) totalExpense += amount;
      }
    }

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    totalExpense = Math.round(totalExpense * 100) / 100;
    const netResult = Math.round((totalRevenue - totalExpense) * 100) / 100;

    return { revenueRows, expenseRows, totalRevenue, totalExpense, netResult };
  }

  async availabilityBalances(asOf?: string) {
    const parent = await this.prisma.ledgerAccount.findFirst({
      where: { code: '1.1' },
    });
    if (!parent) return { accounts: [], total: 0 };

    const children = await this.prisma.ledgerAccount.findMany({
      where: { parentId: parent.id, acceptsEntries: true, active: true },
      orderBy: { code: 'asc' },
    });

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: children.map((c) => c.id) },
        entry: { status: 'POSTED' },
        ...(asOf ? { entry: { date: { lte: new Date(asOf) } } } : {}),
      },
    });

    const accounts = children.map((c) => {
      const accountLines = lines.filter((l) => l.accountId === c.id);
      const debitTotal = accountLines.reduce((sum, l) => sum + Number(l.debit), 0);
      const creditTotal = accountLines.reduce((sum, l) => sum + Number(l.credit), 0);
      const balance = Math.round((debitTotal - creditTotal) * 100) / 100;
      return { code: c.code, name: c.name, balance };
    });

    const total = Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;

    return { accounts, total };
  }

  async summary(from?: string, to?: string) {
    const [availabilities, incomeStatement] = await Promise.all([
      this.availabilityBalances(to),
      this.incomeStatement(from, to),
    ]);

    const lastEntries = await this.prisma.journalEntry.findMany({
      where: { status: { in: ['POSTED', 'VOIDED'] } },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { availabilities, incomeStatement, lastEntries };
  }

  // Excel exports

  async exportLedgerBook(from?: string, to?: string): Promise<Buffer> {
    const rows = await this.ledgerBook(from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Libro Diario');

    ws.columns = [
      { header: 'Asiento', key: 'entryNumber', width: 14 },
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Código', key: 'accountCode', width: 12 },
      { header: 'Cuenta', key: 'accountName', width: 30 },
      { header: 'Debe', key: 'debit', width: 14 },
      { header: 'Haber', key: 'credit', width: 14 },
      { header: 'Estado', key: 'status', width: 12 },
    ];

    this.styleHeader(ws);
    rows.forEach((r) => ws.addRow(r));
    this.styleNumberColumns(ws, [6, 7]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportLedgerAccount(accountId: string, from?: string, to?: string): Promise<Buffer> {
    const data = await this.ledgerAccount(accountId, from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mayor');

    ws.addRow([`Cuenta: ${data.account.code} - ${data.account.name}`]);
    ws.addRow([`Naturaleza: ${data.isDebitNature ? 'Deudora' : 'Acreedora'}`]);
    ws.addRow([]);

    ws.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Asiento', key: 'entryNumber', width: 14 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Debe', key: 'debit', width: 14 },
      { header: 'Haber', key: 'credit', width: 14 },
      { header: 'Saldo', key: 'balance', width: 14 },
    ];

    this.styleHeader(ws, 4);
    data.rows.forEach((r) => ws.addRow(r));
    this.styleNumberColumns(ws, [4, 5, 6], 4);

    ws.addRow([]);
    ws.addRow(['', '', '', '', 'Saldo final:', data.finalBalance]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportTrialBalance(from?: string, to?: string): Promise<Buffer> {
    const data = await this.trialBalance(from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Balance Sumas y Saldos');

    ws.columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Cuenta', key: 'name', width: 30 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Débitos', key: 'totalDebit', width: 14 },
      { header: 'Créditos', key: 'totalCredit', width: 14 },
      { header: 'Saldo Deudor', key: 'debitBalance', width: 14 },
      { header: 'Saldo Acreedor', key: 'creditBalance', width: 14 },
    ];

    this.styleHeader(ws);
    data.rows.forEach((r) => ws.addRow(r));
    this.styleNumberColumns(ws, [4, 5, 6, 7]);

    ws.addRow([]);
    ws.addRow(['', 'TOTALES', '', data.totals.totalDebit, data.totals.totalCredit, data.totals.debitBalance, data.totals.creditBalance]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportIncomeStatement(from?: string, to?: string): Promise<Buffer> {
    const data = await this.incomeStatement(from, to);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Estado de Resultados');

    ws.addRow(['Estado de Resultados']);
    ws.addRow([]);

    ws.addRow(['INGRESOS']);
    data.revenueRows.forEach((r) => ws.addRow([r.code, r.name, r.amount]));
    ws.addRow(['', 'Total Ingresos', data.totalRevenue]);
    ws.addRow([]);

    ws.addRow(['GASTOS']);
    data.expenseRows.forEach((r) => ws.addRow([r.code, r.name, r.amount]));
    ws.addRow(['', 'Total Gastos', data.totalExpense]);
    ws.addRow([]);

    ws.addRow(['', 'Resultado Neto', data.netResult]);

    ws.columns = [
      { width: 12 },
      { width: 30 },
      { width: 14 },
    ];

    this.styleNumberColumns(ws, [3]);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportAvailabilityBalances(asOf?: string): Promise<Buffer> {
    const data = await this.availabilityBalances(asOf);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Disponibilidades');

    ws.addRow(['Saldos de Disponibilidades']);
    ws.addRow([]);

    ws.columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Cuenta', key: 'name', width: 30 },
      { header: 'Saldo', key: 'balance', width: 14 },
    ];

    this.styleHeader(ws);
    data.accounts.forEach((r) => ws.addRow(r));
    this.styleNumberColumns(ws, [3]);

    ws.addRow([]);
    ws.addRow(['', 'Total Disponibilidades', data.total]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private styleHeader(ws: ExcelJS.Worksheet, startRow = 1) {
    const row = ws.getRow(startRow);
    row.font = { bold: true };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF59E0B' },
    };
  }

  private styleNumberColumns(ws: ExcelJS.Worksheet, colIndices: number[], startRow = 2) {
    for (let r = startRow; r <= ws.rowCount; r++) {
      for (const ci of colIndices) {
        const cell = ws.getCell(r, ci);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }
    }
  }
}

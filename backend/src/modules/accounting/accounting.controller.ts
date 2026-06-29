import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ModuleAccess, ModuleKey } from '@prisma/client';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ModuleAccessGuard } from '../common/module-access.guard';
import { RequireModule } from '../common/module-access.decorator';
import { AccountingService } from './accounting.service';
import { LedgerAccountsService } from '../treasury/ledger-accounts.service';
import { AssignCategoryDto } from './dto/assign-category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryManualMovementsDto, QueryMovementsDto } from './dto/query-movements.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule(ModuleKey.TESORERIA, ModuleAccess.READ)
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly ledgerAccountsService: LedgerAccountsService,
  ) {}

  // ─── Treasury Accounts ─────────────────────────────────────────

  @Get('accounts/treasury')
  getTreasuryAccounts() {
    return this.ledgerAccountsService.getTreasuryAccounts();
  }

  // ─── Categories ───────────────────────────────────────────────

  @Get('categories')
  listCategories(@Query('type') type?: string) {
    return this.accountingService.listCategories(type as any);
  }

  @Post('categories')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.accountingService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.accountingService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  deleteCategory(@Param('id') id: string) {
    return this.accountingService.deleteCategory(id);
  }

  // ─── Movements ────────────────────────────────────────────────

  @Get('movements')
  listMovements(@Query() query: QueryMovementsDto) {
    return this.accountingService.listMovements(query);
  }

  @Post('movements')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  createMovement(@Body() dto: CreateMovementDto) {
    return this.accountingService.createMovement(dto);
  }

  @Patch('movements/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  updateMovement(@Param('id') id: string, @Body() dto: UpdateMovementDto) {
    return this.accountingService.updateMovement(id, dto);
  }

  @Delete('movements/:id')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  deleteMovement(@Param('id') id: string) {
    return this.accountingService.deleteMovement(id);
  }

  // ─── Manual Movement Categories ───────────────────────────────

  @Get('manual-movements')
  listManualMovements(@Query() query: QueryManualMovementsDto) {
    return this.accountingService.listManualMovements(query);
  }

  @Post('manual-movements/:id/category')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  assignCategory(@Param('id') id: string, @Body() dto: AssignCategoryDto) {
    return this.accountingService.assignCategoryToManualMovement(id, dto);
  }

  @Delete('manual-movements/:id/category')
  @RequireModule(ModuleKey.TESORERIA, ModuleAccess.FULL)
  removeCategory(@Param('id') id: string) {
    return this.accountingService.removeCategoryFromManualMovement(id);
  }

  // ─── Summary ──────────────────────────────────────────────────

  @Get('summary')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountingService.getSummary({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  // ─── Export ───────────────────────────────────────────────────

  @Get('export')
  async exportExcel(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const data = await this.accountingService.getExportData({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const headerFont = { bold: true };
    const arsFormat = '#,##0.00';

    // Hoja 1: Movimientos
    const ws1 = workbook.addWorksheet('Movimientos');
    ws1.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Origen', key: 'origin', width: 22 },
      { header: 'Categoría', key: 'category', width: 22 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Referencia', key: 'reference', width: 14 },
      { header: 'Monto', key: 'amount', width: 16 },
    ];

    const headerRow1 = ws1.getRow(1);
    headerRow1.font = headerFont;

    for (const m of data.movements) {
      const row = ws1.addRow({
        id: m.id.slice(0, 8),
        date: m.date.toISOString().slice(0, 10),
        type: m.type === 'INCOME' ? 'Ingreso' : 'Egreso',
        origin: m.origin,
        category: m.category,
        description: m.description,
        reference: m.reference,
        amount: m.amount,
      });
      row.getCell('amount').numFmt = arsFormat;
    }

    // Adjust column widths
    ws1.columns.forEach((col) => {
      let max = (col.header || '').length;
      (ws1.getColumn(col.key!).values as any[]).slice(1).forEach((v) => {
        const len = String(v ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 4, 50);
    });

    // Hoja 2: Resumen por categoría
    const ws2 = workbook.addWorksheet('Resumen por categoría');
    ws2.columns = [
      { header: 'Categoría', key: 'category', width: 30 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Total', key: 'total', width: 16 },
    ];

    const headerRow2 = ws2.getRow(1);
    headerRow2.font = headerFont;

    for (const c of data.categorySummary) {
      if (c.total === 0) continue;
      const row = ws2.addRow({
        category: c.category,
        type: c.type === 'INCOME' ? 'Ingreso' : 'Egreso',
        total: c.total,
      });
      row.getCell('total').numFmt = arsFormat;
    }

    ws2.columns.forEach((col) => {
      let max = (col.header || '').length;
      (ws2.getColumn(col.key!).values as any[]).slice(1).forEach((v) => {
        const len = String(v ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 4, 50);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="contabilidad.xlsx"',
    });
    res.send(Buffer.from(buffer));
  }
}

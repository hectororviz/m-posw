import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import ExcelJS from 'exceljs';
import { PrismaService } from '../common/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

interface SummaryRow {
  id: string;
  name: string;
  quantity: number;
  total: number;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildDateFilter(query: ReportQueryDto) {
    const from = query.from ? startOfDay(parseISO(query.from)) : undefined;
    const to = query.to ? endOfDay(parseISO(query.to)) : undefined;

    if (from && to) {
      return Prisma.sql`AND s."createdAt" BETWEEN ${from} AND ${to}`;
    }
    if (from) {
      return Prisma.sql`AND s."createdAt" >= ${from}`;
    }
    if (to) {
      return Prisma.sql`AND s."createdAt" <= ${to}`;
    }
    return Prisma.empty;
  }

  async summaryByProduct(query: ReportQueryDto): Promise<SummaryRow[]> {
    const dateFilter = this.buildDateFilter(query);
    const rows = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT p.id, p.name,
        SUM(si.quantity)::int AS quantity,
        SUM(si.subtotal)::float AS total
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      WHERE 1=1
      ${dateFilter}
      GROUP BY p.id, p.name
      ORDER BY total DESC;
    `);
    return rows;
  }

  async summaryByCategory(query: ReportQueryDto): Promise<SummaryRow[]> {
    const dateFilter = this.buildDateFilter(query);
    const rows = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT c.id, c.name,
        SUM(si.quantity)::int AS quantity,
        SUM(si.subtotal)::float AS total
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "Product" p ON p.id = si."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE 1=1
      ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY total DESC;
    `);
    return rows;
  }

  async exportSummary(query: ReportQueryDto) {
    const byProduct = await this.summaryByProduct(query);
    const byCategory = await this.summaryByCategory(query);

    const workbook = new ExcelJS.Workbook();

    const productSheet = workbook.addWorksheet('Resumen por producto');
    productSheet.addRow(['Producto', 'Cantidad', 'Total']);
    byProduct.forEach((row) => {
      productSheet.addRow([row.name, row.quantity, row.total]);
    });

    const categorySheet = workbook.addWorksheet('Resumen por categoría');
    categorySheet.addRow(['Categoría', 'Cantidad', 'Total']);
    byCategory.forEach((row) => {
      categorySheet.addRow([row.name, row.quantity, row.total]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

interface TotalRow {
  label: string;
  total: number;
}

interface AverageRow {
  id: string;
  name: string;
  averageDaily: number;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  totalsByDay() {
    return this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
      SELECT to_char(s."createdAt"::date, 'YYYY-MM-DD') AS label,
             SUM(s.total)::float AS total
      FROM "Sale" s
      GROUP BY s."createdAt"::date
      ORDER BY s."createdAt"::date DESC
      LIMIT 15;
    `);
  }

  totalsByMonth() {
    return this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', s."createdAt"), 'YYYY-MM') AS label,
             SUM(s.total)::float AS total
      FROM "Sale" s
      GROUP BY date_trunc('month', s."createdAt")
      ORDER BY date_trunc('month', s."createdAt") DESC
      LIMIT 6;
    `);
  }

  averageDailyByCategory() {
    return this.prisma.$queryRaw<AverageRow[]>(Prisma.sql`
      WITH daily AS (
        SELECT c.id, c.name, s."createdAt"::date AS day,
               SUM(si.subtotal)::float AS total
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Product" p ON p.id = si."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        GROUP BY c.id, c.name, s."createdAt"::date
      )
      SELECT id, name, AVG(total)::float AS "averageDaily"
      FROM daily
      GROUP BY id, name
      ORDER BY "averageDaily" DESC;
    `);
  }

  averageDailyByProduct() {
    return this.prisma.$queryRaw<AverageRow[]>(Prisma.sql`
      WITH daily AS (
        SELECT p.id, p.name, s."createdAt"::date AS day,
               SUM(si.subtotal)::float AS total
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Product" p ON p.id = si."productId"
        GROUP BY p.id, p.name, s."createdAt"::date
      )
      SELECT id, name, AVG(total)::float AS "averageDaily"
      FROM daily
      GROUP BY id, name
      ORDER BY "averageDaily" DESC;
    `);
  }
}

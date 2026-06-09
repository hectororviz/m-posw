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

export interface StatsSummary {
  totalSales: number;
  salesCount: number;
  avgTicket: number;
  totalProducts: number;
  topProduct: string;
  byProduct: { name: string; quantity: number }[];
  byPaymentMethod: { method: string; total: number }[];
  byDay: { date: string; total: number }[];
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

  async summary(from?: string, to?: string): Promise<StatsSummary> {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const dateFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
    const dateTo = to ? new Date(`${to}T23:59:59`) : new Date(today.setHours(23, 59, 59, 999));

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: 'APPROVED',
      },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const salesCount = sales.length;
    const avgTicket = salesCount > 0 ? totalSales / salesCount : 0;

    const productMap = new Map<string, number>();
    let totalProducts = 0;
    for (const s of sales) {
      for (const item of s.items) {
        const name = item.product?.name ?? 'Sin nombre';
        productMap.set(name, (productMap.get(name) || 0) + item.quantity);
        totalProducts += item.quantity;
      }
    }
    const byProduct = Array.from(productMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
    const topProduct = byProduct[0]?.name ?? '—';

    const paymentMap = new Map<string, number>();
    for (const s of sales) {
      const method = s.paymentMethod ?? 'CASH';
      paymentMap.set(method, (paymentMap.get(method) || 0) + Number(s.total));
    }
    const byPaymentMethod = Array.from(paymentMap.entries()).map(([method, total]) => ({
      method,
      total,
    }));

    const dayMap = new Map<string, number>();
    for (const s of sales) {
      const dk = s.createdAt.toISOString().slice(0, 10);
      dayMap.set(dk, (dayMap.get(dk) || 0) + Number(s.total));
    }
    const byDay = Array.from(dayMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSales,
      salesCount,
      avgTicket,
      totalProducts,
      topProduct,
      byProduct,
      byPaymentMethod,
      byDay,
    };
  }
}

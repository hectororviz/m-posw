"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
let StatsService = class StatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    totalsByDay() {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT to_char(s."createdAt"::date, 'YYYY-MM-DD') AS label,
             SUM(s.total)::float AS total
      FROM "Sale" s
      GROUP BY s."createdAt"::date
      ORDER BY s."createdAt"::date DESC
      LIMIT 15;
    `);
    }
    totalsByMonth() {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT to_char(date_trunc('month', s."createdAt"), 'YYYY-MM') AS label,
             SUM(s.total)::float AS total
      FROM "Sale" s
      GROUP BY date_trunc('month', s."createdAt")
      ORDER BY date_trunc('month', s."createdAt") DESC
      LIMIT 6;
    `);
    }
    averageDailyByCategory() {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
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
        return this.prisma.$queryRaw(client_1.Prisma.sql `
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
    async summary(from, to) {
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
        const productMap = new Map();
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
        const paymentMap = new Map();
        for (const s of sales) {
            const method = s.paymentMethod ?? 'CASH';
            paymentMap.set(method, (paymentMap.get(method) || 0) + Number(s.total));
        }
        const byPaymentMethod = Array.from(paymentMap.entries()).map(([method, total]) => ({
            method,
            total,
        }));
        const dayMap = new Map();
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
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatsService);

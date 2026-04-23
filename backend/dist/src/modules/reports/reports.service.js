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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const exceljs_1 = require("exceljs");
const prisma_service_1 = require("../common/prisma.service");
let ReportsService = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    buildDateFilter(query) {
        const from = query.from ? (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(query.from)) : undefined;
        const to = query.to ? (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(query.to)) : undefined;
        if (from && to) {
            return client_1.Prisma.sql `AND s."createdAt" BETWEEN ${from} AND ${to}`;
        }
        if (from) {
            return client_1.Prisma.sql `AND s."createdAt" >= ${from}`;
        }
        if (to) {
            return client_1.Prisma.sql `AND s."createdAt" <= ${to}`;
        }
        return client_1.Prisma.empty;
    }
    async summaryByProduct(query) {
        const dateFilter = this.buildDateFilter(query);
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
    async summaryByCategory(query) {
        const dateFilter = this.buildDateFilter(query);
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
    async exportSummary(query) {
        const byProduct = await this.summaryByProduct(query);
        const byCategory = await this.summaryByCategory(query);
        const workbook = new exceljs_1.default.Workbook();
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
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);

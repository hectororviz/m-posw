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
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatsService);

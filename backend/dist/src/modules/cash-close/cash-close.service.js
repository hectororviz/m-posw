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
exports.CashCloseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const ZERO = new client_1.Prisma.Decimal(0);
let CashCloseService = class CashCloseService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    round(value) {
        return new client_1.Prisma.Decimal(value.toDecimalPlaces(2));
    }
    async getCurrentPeriodBounds(now) {
        const lastClose = await this.prisma.cashClose.findFirst({ orderBy: { to: 'desc' } });
        if (lastClose) {
            return { from: lastClose.to, to: now };
        }
        const [firstSale, firstMovement] = await Promise.all([
            this.prisma.sale.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
            this.prisma.manualMovement.findFirst({
                select: { createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        const firstEvent = [firstSale?.createdAt, firstMovement?.createdAt]
            .filter((value) => Boolean(value))
            .sort((a, b) => a.getTime() - b.getTime())[0];
        return { from: firstEvent ?? now, to: now };
    }
    async buildSummary(from, to) {
        const [sales, movements] = await Promise.all([
            this.prisma.sale.findMany({
                where: {
                    createdAt: { gte: from, lte: to },
                    OR: [{ status: client_1.SaleStatus.APPROVED }, { paymentStatus: client_1.PaymentStatus.APPROVED }],
                },
                select: {
                    total: true,
                    paymentMethod: true,
                },
            }),
            this.prisma.manualMovement.findMany({
                where: {
                    createdAt: { gte: from, lte: to },
                },
                select: {
                    amount: true,
                    type: true,
                },
            }),
        ]);
        const salesCashTotal = sales
            .filter((sale) => sale.paymentMethod === 'CASH')
            .reduce((acc, sale) => acc.add(sale.total), ZERO);
        const salesQrTotal = sales
            .filter((sale) => sale.paymentMethod === 'MP_QR')
            .reduce((acc, sale) => acc.add(sale.total), ZERO);
        const salesTransferTotal = sales
            .filter((sale) => sale.paymentMethod === 'TRANSFER')
            .reduce((acc, sale) => acc.add(sale.total), ZERO);
        const salesTotal = salesCashTotal.add(salesQrTotal).add(salesTransferTotal);
        const movementsOutTotal = movements
            .filter((movement) => movement.type === client_1.MovementType.SALIDA)
            .reduce((acc, movement) => acc.add(movement.amount), ZERO);
        const movementsInTotal = movements
            .filter((movement) => movement.type === client_1.MovementType.ENTRADA)
            .reduce((acc, movement) => acc.add(movement.amount), ZERO);
        const movementsNet = movementsInTotal.sub(movementsOutTotal);
        const netCashDelta = salesCashTotal.add(movementsNet);
        return {
            salesCashTotal: this.round(salesCashTotal),
            salesQrTotal: this.round(salesQrTotal),
            salesTransferTotal: this.round(salesTransferTotal),
            salesTotal: this.round(salesTotal),
            salesCount: sales.length,
            movementsOutTotal: this.round(movementsOutTotal),
            movementsInTotal: this.round(movementsInTotal),
            movementsNet: this.round(movementsNet),
            netCashDelta: this.round(netCashDelta),
            movementsCount: movements.length,
        };
    }
    async getCurrentPeriod() {
        const now = new Date();
        const { from, to } = await this.getCurrentPeriodBounds(now);
        const summary = await this.buildSummary(from, to);
        return { from, to, summary };
    }
    async closeCurrentPeriod(userId, note) {
        const now = new Date();
        const { from, to } = await this.getCurrentPeriodBounds(now);
        const summary = await this.buildSummary(from, to);
        const cashClose = await this.prisma.cashClose.create({
            data: {
                from,
                to,
                closedAt: to,
                closedByUserId: userId,
                note: note?.trim() || null,
                ...summary,
            },
        });
        return { cashClose, from, to, summary };
    }
    async getById(id) {
        const cashClose = await this.prisma.cashClose.findUnique({
            where: { id },
            include: { closedBy: { select: { id: true, name: true, role: true } } },
        });
        if (!cashClose) {
            throw new common_1.NotFoundException('Cierre no encontrado');
        }
        return cashClose;
    }
    list(limit = 20, offset = 0) {
        return this.prisma.cashClose.findMany({
            include: { closedBy: { select: { id: true, name: true, role: true } } },
            orderBy: { to: 'desc' },
            take: Math.min(limit, 100),
            skip: offset,
        });
    }
};
exports.CashCloseService = CashCloseService;
exports.CashCloseService = CashCloseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CashCloseService);

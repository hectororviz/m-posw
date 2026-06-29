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
var AccountingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const ZERO = new client_1.Prisma.Decimal(0);
let AccountingService = AccountingService_1 = class AccountingService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AccountingService_1.name);
    }
    round(value) {
        return new client_1.Prisma.Decimal(value.toDecimalPlaces(2));
    }
    roundNumber(value) {
        return Math.round(value * 100) / 100;
    }
    async listCategories(type) {
        return this.prisma.accountingCategory.findMany({
            where: type ? { type } : undefined,
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { movements: true } },
            },
        });
    }
    async createCategory(dto) {
        return this.prisma.accountingCategory.create({
            data: dto,
        });
    }
    async updateCategory(id, dto) {
        const category = await this.prisma.accountingCategory.findUnique({ where: { id } });
        if (!category)
            throw new common_1.NotFoundException('Categoría no encontrada');
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.active !== undefined)
            data.active = dto.active;
        return this.prisma.accountingCategory.update({ where: { id }, data });
    }
    async deleteCategory(id) {
        const category = await this.prisma.accountingCategory.findUnique({
            where: { id },
            include: { _count: { select: { movements: true } } },
        });
        if (!category)
            throw new common_1.NotFoundException('Categoría no encontrada');
        if (category._count.movements > 0) {
            throw new common_1.ConflictException('No se puede eliminar la categoría porque tiene movimientos asociados. Desactívala en su lugar.');
        }
        return this.prisma.accountingCategory.delete({ where: { id } });
    }
    async listMovements(params) {
        const where = {};
        if (params.from || params.to) {
            where.date = {};
            if (params.from)
                where.date.gte = params.from;
            if (params.to)
                where.date.lte = params.to;
        }
        if (params.type)
            where.type = params.type;
        if (params.categoryId)
            where.categoryId = params.categoryId;
        return this.prisma.accountingMovement.findMany({
            where,
            include: { category: true },
            orderBy: { date: 'desc' },
        });
    }
    async createMovement(dto) {
        const category = await this.prisma.accountingCategory.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category)
            throw new common_1.NotFoundException('Categoría no encontrada');
        if (category.type !== dto.type) {
            throw new common_1.BadRequestException('El tipo de movimiento no coincide con el tipo de la categoría');
        }
        if (dto.refMovementId) {
            const ref = await this.prisma.accountingMovement.findUnique({
                where: { id: dto.refMovementId },
            });
            if (!ref)
                throw new common_1.NotFoundException('Movimiento de referencia no encontrado');
        }
        return this.prisma.accountingMovement.create({
            data: {
                type: dto.type,
                amount: this.roundNumber(dto.amount),
                description: dto.description,
                date: dto.date,
                categoryId: dto.categoryId,
                refMovementId: dto.refMovementId ?? null,
            },
            include: { category: true },
        });
    }
    async updateMovement(id, dto) {
        const movement = await this.prisma.accountingMovement.findUnique({ where: { id } });
        if (!movement)
            throw new common_1.NotFoundException('Movimiento no encontrado');
        if (dto.categoryId) {
            const category = await this.prisma.accountingCategory.findUnique({
                where: { id: dto.categoryId },
            });
            if (!category)
                throw new common_1.NotFoundException('Categoría no encontrada');
            if (category.type !== movement.type) {
                throw new common_1.BadRequestException('El tipo de la nueva categoría no coincide con el tipo del movimiento');
            }
        }
        const data = { updatedAt: new Date() };
        if (dto.description !== undefined)
            data.description = dto.description;
        if (dto.categoryId !== undefined)
            data.categoryId = dto.categoryId;
        if (dto.refMovementId !== undefined)
            data.refMovementId = dto.refMovementId || null;
        return this.prisma.accountingMovement.update({
            where: { id },
            data,
            include: { category: true },
        });
    }
    async deleteMovement(id) {
        const movement = await this.prisma.accountingMovement.findUnique({
            where: { id },
            include: { category: true },
        });
        if (!movement)
            throw new common_1.NotFoundException('Movimiento no encontrado');
        const counterMovement = await this.prisma.accountingMovement.findFirst({
            where: { refMovementId: id },
        });
        if (counterMovement) {
            throw new common_1.ConflictException(`No se puede eliminar: el movimiento ${counterMovement.id.slice(0, 8)} lo referencia como contra-movimiento.`);
        }
        return this.prisma.accountingMovement.delete({ where: { id } });
    }
    async listManualMovements(params) {
        const where = {};
        if (params.from || params.to) {
            where.createdAt = {};
            if (params.from)
                where.createdAt.gte = params.from;
            if (params.to)
                where.createdAt.lte = params.to;
        }
        if (params.type === 'ENTRADA' || params.type === 'SALIDA') {
            where.type = params.type;
        }
        return this.prisma.manualMovement.findMany({
            where,
            include: {
                user: { select: { id: true, username: true } },
                manualMovementCategory: {
                    include: { category: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async assignCategoryToManualMovement(manualMovementId, dto) {
        const mm = await this.prisma.manualMovement.findUnique({
            where: { id: manualMovementId },
        });
        if (!mm)
            throw new common_1.NotFoundException('Movimiento de jornada no encontrado');
        const category = await this.prisma.accountingCategory.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category)
            throw new common_1.NotFoundException('Categoría contable no encontrada');
        const expectedType = mm.type === client_1.MovementType.ENTRADA ? client_1.AccountingMovementType.INCOME : client_1.AccountingMovementType.EXPENSE;
        if (category.type !== expectedType) {
            throw new common_1.BadRequestException(`La categoría debe ser de tipo ${expectedType} para un movimiento de tipo ${mm.type}`);
        }
        return this.prisma.manualMovementCategory.upsert({
            where: { manualMovementId },
            update: { categoryId: dto.categoryId },
            create: { manualMovementId, categoryId: dto.categoryId },
        });
    }
    async removeCategoryFromManualMovement(manualMovementId) {
        const mmc = await this.prisma.manualMovementCategory.findUnique({
            where: { manualMovementId },
        });
        if (!mmc)
            throw new common_1.NotFoundException('No hay categoría asignada a este movimiento');
        return this.prisma.manualMovementCategory.delete({
            where: { manualMovementId },
        });
    }
    async getSummary(params) {
        const from = params.from;
        const to = params.to;
        const [cashCloses, manualMovements, accountingMovements, categories] = await Promise.all([
            params.from || params.to
                ? this.prisma.cashClose.findMany({
                    where: { to: { gte: from, lte: to } },
                    select: {
                        salesTotal: true,
                        salesCashTotal: true,
                        salesQrTotal: true,
                        salesTransferTotal: true,
                        movementsInTotal: true,
                        movementsOutTotal: true,
                        to: true,
                    },
                })
                : Promise.resolve([]),
            this.prisma.manualMovement.findMany({
                where: {
                    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
                select: { type: true, amount: true, createdAt: true },
            }),
            this.prisma.accountingMovement.findMany({
                where: {
                    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
                include: { category: true },
            }),
            this.prisma.accountingCategory.findMany({ where: { active: true } }),
        ]);
        const jornadaSalesTotal = cashCloses.reduce((sum, c) => sum.add(c.salesTotal), ZERO);
        const jornadaMovementsInTotal = cashCloses.reduce((sum, c) => sum.add(c.movementsInTotal), ZERO);
        const jornadaMovementsOutTotal = cashCloses.reduce((sum, c) => sum.add(c.movementsOutTotal), ZERO);
        const mmInTotal = manualMovements
            .filter((m) => m.type === client_1.MovementType.ENTRADA)
            .reduce((sum, m) => sum.add(m.amount), ZERO);
        const mmOutTotal = manualMovements
            .filter((m) => m.type === client_1.MovementType.SALIDA)
            .reduce((sum, m) => sum.add(m.amount), ZERO);
        const totalJornadaMovementsIn = jornadaMovementsInTotal.add(mmInTotal);
        const totalJornadaMovementsOut = jornadaMovementsOutTotal.add(mmOutTotal);
        const accountingIn = accountingMovements
            .filter((m) => m.type === client_1.AccountingMovementType.INCOME)
            .reduce((sum, m) => sum.add(m.amount), ZERO);
        const accountingOut = accountingMovements
            .filter((m) => m.type === client_1.AccountingMovementType.EXPENSE)
            .reduce((sum, m) => sum.add(m.amount), ZERO);
        const totalIncome = jornadaSalesTotal.add(totalJornadaMovementsIn).add(accountingIn);
        const totalExpense = totalJornadaMovementsOut.add(accountingOut);
        const netBalance = totalIncome.sub(totalExpense);
        const byCategory = categories.map((cat) => {
            const total = accountingMovements
                .filter((m) => m.categoryId === cat.id)
                .reduce((sum, m) => sum.add(m.amount), ZERO);
            return {
                categoryId: cat.id,
                categoryName: cat.name,
                type: cat.type,
                total: Number(total),
            };
        });
        const monthlySeries = this.buildMonthlySeries(accountingMovements, manualMovements, cashCloses);
        return {
            totalIncome: Number(this.round(totalIncome)),
            totalExpense: Number(this.round(totalExpense)),
            netBalance: Number(this.round(netBalance)),
            jornadaSalesTotal: Number(this.round(jornadaSalesTotal)),
            jornadaMovementsInTotal: Number(this.round(totalJornadaMovementsIn)),
            jornadaMovementsOutTotal: Number(this.round(totalJornadaMovementsOut)),
            accountingMovementsInTotal: Number(this.round(accountingIn)),
            accountingMovementsOutTotal: Number(this.round(accountingOut)),
            byCategory,
            monthlySeries,
        };
    }
    buildMonthlySeries(accountingMovements, manualMovements, cashCloses) {
        const months = new Map();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.set(key, { income: 0, expense: 0 });
        }
        for (const m of accountingMovements) {
            const key = `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`;
            const entry = months.get(key);
            if (entry) {
                if (m.type === client_1.AccountingMovementType.INCOME) {
                    entry.income += Number(m.amount);
                }
                else {
                    entry.expense += Number(m.amount);
                }
            }
        }
        for (const m of manualMovements) {
            const key = `${m.createdAt.getFullYear()}-${String(m.createdAt.getMonth() + 1).padStart(2, '0')}`;
            const entry = months.get(key);
            if (entry) {
                if (m.type === client_1.MovementType.ENTRADA) {
                    entry.income += Number(m.amount);
                }
                else {
                    entry.expense += Number(m.amount);
                }
            }
        }
        for (const cc of cashCloses) {
            const key = `${cc.to.getFullYear()}-${String(cc.to.getMonth() + 1).padStart(2, '0')}`;
            const entry = months.get(key);
            if (entry) {
                entry.income += Number(cc.salesTotal);
            }
        }
        return Array.from(months.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
            month,
            income: this.roundNumber(data.income),
            expense: this.roundNumber(data.expense),
        }));
    }
    async getExportData(params) {
        const from = params.from;
        const to = params.to;
        const [accountingMovements, manualMovements, cashCloses] = await Promise.all([
            this.prisma.accountingMovement.findMany({
                where: {
                    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
                include: { category: true },
                orderBy: { date: 'asc' },
            }),
            this.prisma.manualMovement.findMany({
                where: {
                    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.cashClose.findMany({
                where: {
                    ...(from || to ? { to: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
                orderBy: { to: 'asc' },
            }),
        ]);
        const categories = await this.prisma.accountingCategory.findMany();
        const movements = [];
        for (const cc of cashCloses) {
            movements.push({
                id: cc.id,
                date: cc.to,
                type: 'INCOME',
                origin: 'Venta de jornada',
                category: 'Ventas',
                description: `Cierre de caja - Ventas totales del período`,
                reference: '',
                amount: Number(cc.salesTotal),
            });
        }
        for (const mm of manualMovements) {
            movements.push({
                id: mm.id,
                date: mm.createdAt,
                type: mm.type === client_1.MovementType.ENTRADA ? 'INCOME' : 'EXPENSE',
                origin: 'Movimiento de jornada',
                category: '',
                description: mm.reason,
                reference: '',
                amount: Number(mm.amount),
            });
        }
        for (const am of accountingMovements) {
            movements.push({
                id: am.id,
                date: am.date,
                type: am.type,
                origin: 'Extra-jornada',
                category: am.category?.name ?? '',
                description: am.description,
                reference: am.refMovementId?.slice(0, 8) ?? '',
                amount: Number(am.amount),
            });
        }
        movements.sort((a, b) => a.date.getTime() - b.date.getTime());
        const categorySummary = categories.map((cat) => {
            const total = accountingMovements
                .filter((m) => m.categoryId === cat.id)
                .reduce((sum, m) => sum + Number(m.amount), 0);
            return { category: cat.name, type: cat.type, total };
        });
        return { movements, categorySummary };
    }
};
exports.AccountingService = AccountingService;
exports.AccountingService = AccountingService = AccountingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccountingService);

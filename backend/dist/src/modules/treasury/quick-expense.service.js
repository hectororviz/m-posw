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
exports.QuickExpenseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let QuickExpenseService = class QuickExpenseService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listButtons() {
        return this.prisma.quickExpenseButton.findMany({
            where: { active: true },
            orderBy: { position: 'asc' },
            include: {
                assetAccount: { select: { id: true, code: true, name: true } },
                expenseAccount: { select: { id: true, code: true, name: true } },
            },
        });
    }
    async listAllButtons() {
        return this.prisma.quickExpenseButton.findMany({
            orderBy: { position: 'asc' },
            include: {
                assetAccount: { select: { id: true, code: true, name: true } },
                expenseAccount: { select: { id: true, code: true, name: true } },
            },
        });
    }
    async createButton(dto) {
        const maxPos = await this.prisma.quickExpenseButton.aggregate({
            _max: { position: true },
        });
        return this.prisma.quickExpenseButton.create({
            data: {
                label: dto.label,
                assetAccountId: dto.assetAccountId,
                expenseAccountId: dto.expenseAccountId,
                position: (maxPos._max.position ?? 0) + 10,
            },
            include: {
                assetAccount: { select: { id: true, code: true, name: true } },
                expenseAccount: { select: { id: true, code: true, name: true } },
            },
        });
    }
    async updateButton(id, dto) {
        const existing = await this.prisma.quickExpenseButton.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Botón no encontrado');
        return this.prisma.quickExpenseButton.update({
            where: { id },
            data: {
                ...(dto.label !== undefined && { label: dto.label }),
                ...(dto.assetAccountId !== undefined && { assetAccountId: dto.assetAccountId }),
                ...(dto.expenseAccountId !== undefined && { expenseAccountId: dto.expenseAccountId }),
                ...(dto.position !== undefined && { position: dto.position }),
                ...(dto.active !== undefined && { active: dto.active }),
            },
            include: {
                assetAccount: { select: { id: true, code: true, name: true } },
                expenseAccount: { select: { id: true, code: true, name: true } },
            },
        });
    }
    async deleteButton(id) {
        const existing = await this.prisma.quickExpenseButton.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Botón no encontrado');
        return this.prisma.quickExpenseButton.delete({ where: { id } });
    }
    async submitExpense(userId, dto) {
        const button = await this.prisma.quickExpenseButton.findUnique({
            where: { id: dto.buttonId },
        });
        if (!button)
            throw new common_1.NotFoundException('Botón no encontrado');
        if (dto.amount <= 0)
            throw new common_1.BadRequestException('El monto debe ser mayor a 0');
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const lastEntry = await this.prisma.journalEntry.findFirst({
            where: { fiscalYear: year, month },
            orderBy: { sequenceNumber: 'desc' },
            select: { sequenceNumber: true },
        });
        const seq = (lastEntry?.sequenceNumber ?? 0) + 1;
        return this.prisma.journalEntry.create({
            data: {
                entryNumber: `${String(seq).padStart(5, '0')}-${String(month).padStart(2, '0')}${String(year).slice(2)}`,
                sequenceNumber: seq,
                fiscalYear: year,
                month,
                date,
                description: button.label,
                notes: dto.note || null,
                createdById: userId,
                status: 'POSTED',
                postedAt: new Date(),
                lines: {
                    create: [
                        {
                            accountId: button.expenseAccountId,
                            debit: dto.amount,
                            credit: 0,
                            description: button.label,
                        },
                        {
                            accountId: button.assetAccountId,
                            debit: 0,
                            credit: dto.amount,
                            description: button.label,
                        },
                    ],
                },
            },
            include: { lines: { include: { account: true } } },
        });
    }
};
exports.QuickExpenseService = QuickExpenseService;
exports.QuickExpenseService = QuickExpenseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuickExpenseService);

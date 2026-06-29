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
exports.LedgerAccountsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let LedgerAccountsService = class LedgerAccountsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const accounts = await this.prisma.ledgerAccount.findMany({
            include: {
                children: { orderBy: { code: 'asc' } },
                _count: { select: { lines: true } },
            },
            orderBy: { code: 'asc' },
        });
        const roots = accounts.filter((a) => !a.parentId);
        return this.buildTree(roots, accounts);
    }
    buildTree(roots, all) {
        return roots.map((root) => ({
            ...root,
            children: all
                .filter((a) => a.parentId === root.id)
                .map((child) => ({
                ...child,
                children: all.filter((a) => a.parentId === child.id),
            })),
        }));
    }
    async listFlat() {
        return this.prisma.ledgerAccount.findMany({
            orderBy: { code: 'asc' },
            include: { _count: { select: { lines: true } } },
        });
    }
    async listImputable(type) {
        const where = { acceptsEntries: true, active: true };
        if (type)
            where.type = type;
        return this.prisma.ledgerAccount.findMany({
            where,
            orderBy: { code: 'asc' },
        });
    }
    async getById(id) {
        const account = await this.prisma.ledgerAccount.findUnique({
            where: { id },
            include: {
                children: { orderBy: { code: 'asc' } },
                _count: { select: { lines: true } },
            },
        });
        if (!account)
            throw new common_1.NotFoundException('Cuenta no encontrada');
        return account;
    }
    async create(dto) {
        const existing = await this.prisma.ledgerAccount.findUnique({ where: { code: dto.code } });
        if (existing)
            throw new common_1.ConflictException('El código ya existe');
        if (dto.parentId) {
            const parent = await this.prisma.ledgerAccount.findUnique({ where: { id: dto.parentId } });
            if (!parent)
                throw new common_1.NotFoundException('Cuenta padre no encontrada');
        }
        return this.prisma.ledgerAccount.create({ data: dto });
    }
    async update(id, dto) {
        const account = await this.prisma.ledgerAccount.findUnique({ where: { id } });
        if (!account)
            throw new common_1.NotFoundException('Cuenta no encontrada');
        if (dto.parentId) {
            const parent = await this.prisma.ledgerAccount.findUnique({ where: { id: dto.parentId } });
            if (!parent)
                throw new common_1.NotFoundException('Cuenta padre no encontrada');
            if (dto.parentId === id)
                throw new common_1.BadRequestException('Una cuenta no puede ser su propio padre');
        }
        return this.prisma.ledgerAccount.update({ where: { id }, data: dto });
    }
    async toggleActive(id) {
        const account = await this.prisma.ledgerAccount.findUnique({ where: { id } });
        if (!account)
            throw new common_1.NotFoundException('Cuenta no encontrada');
        return this.prisma.ledgerAccount.update({
            where: { id },
            data: { active: !account.active },
        });
    }
    async getAssetAccountsImputable() {
        return this.prisma.ledgerAccount.findMany({
            where: { type: 'ASSET', acceptsEntries: true, active: true },
            orderBy: { code: 'asc' },
        });
    }
    async getRevenueAccountsImputable() {
        return this.prisma.ledgerAccount.findMany({
            where: { type: 'REVENUE', acceptsEntries: true, active: true },
            orderBy: { code: 'asc' },
        });
    }
    async getExpenseAccountsImputable() {
        return this.prisma.ledgerAccount.findMany({
            where: { type: 'EXPENSE', acceptsEntries: true, active: true },
            orderBy: { code: 'asc' },
        });
    }
    async getTreasuryAccounts() {
        return this.prisma.ledgerAccount.findMany({
            where: {
                acceptsEntries: true,
                active: true,
                code: { startsWith: '1.1' },
            },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true },
        });
    }
};
exports.LedgerAccountsService = LedgerAccountsService;
exports.LedgerAccountsService = LedgerAccountsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LedgerAccountsService);

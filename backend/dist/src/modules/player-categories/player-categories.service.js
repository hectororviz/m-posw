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
exports.PlayerCategoriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let PlayerCategoriesService = class PlayerCategoriesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const categories = await this.prisma.playerCategory.findMany({
            orderBy: { name: 'asc' },
            include: {
                tournaments: {
                    include: {
                        tournament: { select: { id: true, name: true } },
                    },
                },
            },
        });
        return categories.map((c) => ({
            id: c.id,
            name: c.name,
            restrictionType: c.restrictionType,
            ageMin: c.ageMin,
            ageMax: c.ageMax,
            ageCutoffMonth: c.ageCutoffMonth,
            ageCutoffDay: c.ageCutoffDay,
            birthYear: c.birthYear,
            active: c.active,
            tournaments: c.tournaments.map((tc) => ({
                id: tc.tournament.id,
                name: tc.tournament.name,
            })),
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));
    }
    async findOne(id) {
        const category = await this.prisma.playerCategory.findUnique({
            where: { id },
            include: {
                tournaments: {
                    include: {
                        tournament: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        return {
            id: category.id,
            name: category.name,
            restrictionType: category.restrictionType,
            ageMin: category.ageMin,
            ageMax: category.ageMax,
            ageCutoffMonth: category.ageCutoffMonth,
            ageCutoffDay: category.ageCutoffDay,
            birthYear: category.birthYear,
            active: category.active,
            tournaments: category.tournaments.map((tc) => ({
                id: tc.tournament.id,
                name: tc.tournament.name,
            })),
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        };
    }
    async create(dto) {
        return this.prisma.playerCategory.create({
            data: {
                name: dto.name,
                restrictionType: dto.restrictionType,
                ageMin: dto.ageMin,
                ageMax: dto.ageMax,
                ageCutoffMonth: dto.ageCutoffMonth ?? 12,
                ageCutoffDay: dto.ageCutoffDay ?? 31,
                birthYear: dto.birthYear,
            },
        });
    }
    async update(id, dto) {
        const category = await this.prisma.playerCategory.findUnique({
            where: { id },
        });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        return this.prisma.playerCategory.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.restrictionType !== undefined && { restrictionType: dto.restrictionType }),
                ...(dto.ageMin !== undefined && { ageMin: dto.ageMin }),
                ...(dto.ageMax !== undefined && { ageMax: dto.ageMax }),
                ...(dto.ageCutoffMonth !== undefined && { ageCutoffMonth: dto.ageCutoffMonth }),
                ...(dto.ageCutoffDay !== undefined && { ageCutoffDay: dto.ageCutoffDay }),
                ...(dto.birthYear !== undefined && { birthYear: dto.birthYear }),
                ...(dto.active !== undefined && { active: dto.active }),
            },
        });
    }
    async remove(id) {
        const category = await this.prisma.playerCategory.findUnique({
            where: { id },
            include: {
                tournaments: {
                    include: {
                        tournament: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        if (category.tournaments.length > 0) {
            const names = category.tournaments
                .map((tc) => tc.tournament.name)
                .join(', ');
            throw new common_1.BadRequestException(`No se puede eliminar la categoría porque está en uso en los torneos: ${names}`);
        }
        return this.prisma.playerCategory.delete({ where: { id } });
    }
};
exports.PlayerCategoriesService = PlayerCategoriesService;
exports.PlayerCategoriesService = PlayerCategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayerCategoriesService);

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
exports.AssetCategoriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let AssetCategoriesService = class AssetCategoriesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.assetCategory.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { assets: true } },
            },
        });
    }
    async findOne(id) {
        const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
        if (!cat)
            throw new common_1.NotFoundException('Categoría no encontrada');
        return cat;
    }
    async create(dto) {
        const existing = await this.prisma.assetCategory.findUnique({ where: { name: dto.name } });
        if (existing)
            throw new common_1.BadRequestException('Ya existe una categoría con ese nombre');
        return this.prisma.assetCategory.create({ data: { name: dto.name } });
    }
    async update(id, dto) {
        const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
        if (!cat)
            throw new common_1.NotFoundException('Categoría no encontrada');
        if (dto.name !== undefined) {
            const existing = await this.prisma.assetCategory.findUnique({ where: { name: dto.name } });
            if (existing && existing.id !== id) {
                throw new common_1.BadRequestException('Ya existe una categoría con ese nombre');
            }
        }
        return this.prisma.assetCategory.update({
            where: { id },
            data: dto,
        });
    }
    async toggle(id) {
        const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
        if (!cat)
            throw new common_1.NotFoundException('Categoría no encontrada');
        if (cat.isActive) {
            const activeAssets = await this.prisma.asset.count({
                where: { categoryId: id, isActive: true },
            });
            if (activeAssets > 0) {
                throw new common_1.BadRequestException('No se puede desactivar una categoría con bienes activos asociados');
            }
        }
        return this.prisma.assetCategory.update({
            where: { id },
            data: { isActive: !cat.isActive },
        });
    }
};
exports.AssetCategoriesService = AssetCategoriesService;
exports.AssetCategoriesService = AssetCategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssetCategoriesService);

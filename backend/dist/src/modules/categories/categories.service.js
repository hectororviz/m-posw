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
var CategoriesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const image_storage_1 = require("../common/image-storage");
const prisma_service_1 = require("../common/prisma.service");
let CategoriesService = CategoriesService_1 = class CategoriesService {
    constructor(prisma) {
        this.prisma = prisma;
        this.defaultColor = '#0EA5E9';
        this.logger = new common_1.Logger(CategoriesService_1.name);
    }
    listActive() {
        return this.prisma.category.findMany({
            where: { active: true },
            orderBy: { name: 'asc' },
        });
    }
    listAll() {
        return this.prisma.category.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    create(dto) {
        return this.prisma.category.create({
            data: {
                ...dto,
                colorHex: dto.colorHex ?? this.defaultColor,
                active: dto.active ?? true,
            },
        });
    }
    update(id, dto) {
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.iconName !== undefined)
            data.iconName = dto.iconName;
        if (dto.colorHex !== undefined)
            data.colorHex = dto.colorHex;
        if (dto.active !== undefined)
            data.active = dto.active;
        if (process.env.NODE_ENV !== 'production') {
            this.logger.debug(`Updating category ${id} with data: ${JSON.stringify(data)}`);
        }
        return this.prisma.category.update({ where: { id }, data });
    }
    listProducts(categoryId, includeInactive = false) {
        return this.prisma.product.findMany({
            where: {
                categoryId,
                ...(includeInactive ? {} : { active: true }),
            },
            orderBy: { name: 'asc' },
        });
    }
    async remove(id) {
        const productCount = await this.prisma.product.count({ where: { categoryId: id } });
        if (productCount > 0) {
            throw new common_1.ConflictException('No se puede borrar: tiene productos asociados');
        }
        return this.prisma.category.delete({ where: { id } });
    }
    async uploadImage(id, file) {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        await (0, image_storage_1.saveImageFile)('categories', id, file);
        return this.prisma.category.update({
            where: { id },
            data: {
                imagePath: (0, image_storage_1.buildImageRelativePath)('categories', id),
                imageUpdatedAt: new Date(),
            },
        });
    }
    async deleteImage(id) {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (!category) {
            throw new common_1.NotFoundException('Categoría no encontrada');
        }
        await (0, image_storage_1.deleteImageFolder)('categories', id);
        return this.prisma.category.update({
            where: { id },
            data: {
                imagePath: null,
                imageUpdatedAt: null,
            },
        });
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = CategoriesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoriesService);

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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const image_storage_1 = require("../common/image-storage");
const prisma_service_1 = require("../common/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listActive(categoryId) {
        return this.prisma.product.findMany({
            where: { active: true, categoryId },
            orderBy: { name: 'asc' },
        });
    }
    listAll() {
        return this.prisma.product.findMany({
            include: { category: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    create(dto) {
        return this.prisma.product.create({ data: { ...dto, active: dto.active ?? true } });
    }
    update(id, dto) {
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.price !== undefined)
            data.price = dto.price;
        if (dto.categoryId !== undefined)
            data.categoryId = dto.categoryId;
        if (dto.iconName !== undefined)
            data.iconName = dto.iconName;
        if (dto.colorHex !== undefined)
            data.colorHex = dto.colorHex;
        if (dto.active !== undefined)
            data.active = dto.active;
        return this.prisma.product.update({ where: { id }, data });
    }
    async remove(id) {
        const saleItemCount = await this.prisma.saleItem.count({ where: { productId: id } });
        if (saleItemCount > 0) {
            throw new common_1.ConflictException('Producto usado en ventas');
        }
        return this.prisma.product.delete({ where: { id } });
    }
    async uploadImage(id, file) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        await (0, image_storage_1.saveImageFile)('products', id, file);
        return this.prisma.product.update({
            where: { id },
            data: {
                imagePath: (0, image_storage_1.buildImageRelativePath)('products', id),
                imageUpdatedAt: new Date(),
            },
        });
    }
    async deleteImage(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        await (0, image_storage_1.deleteImageFolder)('products', id);
        return this.prisma.product.update({
            where: { id },
            data: {
                imagePath: null,
                imageUpdatedAt: null,
            },
        });
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);

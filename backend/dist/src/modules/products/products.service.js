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
const client_1 = require("@prisma/client");
const image_storage_1 = require("../common/image-storage");
const prisma_service_1 = require("../common/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listActive(categoryId) {
        return this.prisma.product.findMany({
            where: {
                active: true,
                categoryId,
                type: { not: client_1.ProductType.RAW_MATERIAL },
            },
            orderBy: { name: 'asc' },
        });
    }
    listAll() {
        return this.prisma.product.findMany({
            include: {
                category: true,
                recipeAsComposite: {
                    include: {
                        rawMaterial: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    listRawMaterials() {
        return this.prisma.product.findMany({
            where: {
                active: true,
                type: client_1.ProductType.RAW_MATERIAL,
            },
            orderBy: { name: 'asc' },
        });
    }
    async create(dto) {
        const { ingredients, ...productData } = dto;
        if (ingredients && ingredients.length > 0) {
            await this.validateIngredients(ingredients);
        }
        return this.prisma.$transaction(async (tx) => {
            const type = productData.type ?? client_1.ProductType.SIMPLE;
            let categoryId = productData.categoryId;
            let price = productData.price;
            if (type === client_1.ProductType.RAW_MATERIAL) {
                price = 0;
                if (!categoryId) {
                    let defaultCategory = await tx.category.findFirst({
                        where: { name: 'Materias Primas', active: true },
                    });
                    if (!defaultCategory) {
                        defaultCategory = await tx.category.findFirst({
                            where: { active: true },
                            orderBy: { createdAt: 'asc' },
                        });
                    }
                    if (!defaultCategory) {
                        throw new common_1.BadRequestException('No hay categorías disponibles. Cree una categoría primero.');
                    }
                    categoryId = defaultCategory.id;
                }
            }
            if (type !== client_1.ProductType.RAW_MATERIAL && !categoryId) {
                throw new common_1.BadRequestException('La categoría es requerida para este tipo de producto');
            }
            const product = await tx.product.create({
                data: {
                    name: productData.name,
                    price: price ?? 0,
                    categoryId: categoryId,
                    type,
                    iconName: productData.iconName,
                    colorHex: productData.colorHex,
                    active: productData.active ?? true,
                },
            });
            if (type === client_1.ProductType.COMPOSITE && ingredients && ingredients.length > 0) {
                await tx.recipeIngredient.createMany({
                    data: ingredients.map(ing => ({
                        compositeId: product.id,
                        rawMaterialId: ing.rawMaterialId,
                        quantity: ing.quantity,
                    })),
                });
            }
            return tx.product.findUnique({
                where: { id: product.id },
                include: {
                    category: true,
                    recipeAsComposite: {
                        include: {
                            rawMaterial: true,
                        },
                    },
                },
            });
        });
    }
    async update(id, dto) {
        const { ingredients, ...productData } = dto;
        const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            include: {
                recipeAsComposite: true,
            },
        });
        if (!existingProduct) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        if (ingredients && ingredients.length > 0) {
            await this.validateIngredients(ingredients);
        }
        return this.prisma.$transaction(async (tx) => {
            const data = {};
            if (productData.name !== undefined)
                data.name = productData.name;
            if (productData.price !== undefined)
                data.price = productData.price;
            if (productData.categoryId !== undefined)
                data.categoryId = productData.categoryId;
            if (productData.iconName !== undefined)
                data.iconName = productData.iconName;
            if (productData.colorHex !== undefined)
                data.colorHex = productData.colorHex;
            if (productData.active !== undefined)
                data.active = productData.active;
            if (productData.type !== undefined)
                data.type = productData.type;
            const product = await tx.product.update({
                where: { id },
                data,
                include: {
                    category: true,
                },
            });
            if (ingredients !== undefined) {
                await tx.recipeIngredient.deleteMany({
                    where: { compositeId: id },
                });
                if (product.type === client_1.ProductType.COMPOSITE && ingredients.length > 0) {
                    await tx.recipeIngredient.createMany({
                        data: ingredients.map(ing => ({
                            compositeId: id,
                            rawMaterialId: ing.rawMaterialId,
                            quantity: ing.quantity,
                        })),
                    });
                }
            }
            return tx.product.findUnique({
                where: { id },
                include: {
                    category: true,
                    recipeAsComposite: {
                        include: {
                            rawMaterial: true,
                        },
                    },
                },
            });
        });
    }
    async remove(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                saleItems: true,
                recipeAsComposite: true,
                recipeAsRawMaterial: true,
            },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        if (product.saleItems.length > 0) {
            throw new common_1.ConflictException('Producto usado en ventas');
        }
        if (product.recipeAsRawMaterial.length > 0) {
            throw new common_1.ConflictException('No se puede eliminar: es ingrediente de otros productos');
        }
        return this.prisma.$transaction(async (tx) => {
            if (product.recipeAsComposite.length > 0) {
                await tx.recipeIngredient.deleteMany({
                    where: { compositeId: id },
                });
            }
            return tx.product.delete({ where: { id } });
        });
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
    async validateIngredients(ingredients) {
        const rawMaterialIds = ingredients.map(i => i.rawMaterialId);
        const rawMaterials = await this.prisma.product.findMany({
            where: {
                id: { in: rawMaterialIds },
                type: client_1.ProductType.RAW_MATERIAL,
                active: true,
            },
        });
        if (rawMaterials.length !== rawMaterialIds.length) {
            throw new common_1.BadRequestException('Uno o más ingredientes no son materias primas válidas');
        }
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);

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
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
let StockService = class StockService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getStockGroupedByCategory() {
        const products = await this.prisma.product.findMany({
            where: {
                active: true,
                type: { in: [client_1.ProductType.SIMPLE, client_1.ProductType.RAW_MATERIAL] },
            },
            include: {
                category: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
        const categoriesMap = new Map();
        for (const product of products) {
            const categoryId = product.category?.id || 'uncategorized';
            const categoryName = product.category?.name || 'Sin categoría';
            const categoryColor = product.category?.colorHex || '#999999';
            if (!categoriesMap.has(categoryId)) {
                categoriesMap.set(categoryId, {
                    id: categoryId,
                    name: categoryName,
                    colorHex: categoryColor,
                    products: [],
                });
            }
            const stockNumber = Number(product.stock);
            const displayStock = product.type === client_1.ProductType.RAW_MATERIAL
                ? Math.round(stockNumber * 10000) / 10000
                : Math.floor(stockNumber);
            categoriesMap.get(categoryId).products.push({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                stock: displayStock,
                categoryId: product.categoryId,
                type: product.type,
            });
        }
        return Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }
    async updateStock(productId, stock) {
        return this.prisma.product.update({
            where: { id: productId },
            data: { stock },
            select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                categoryId: true,
                type: true,
            },
        });
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockService);

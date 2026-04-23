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
const prisma_service_1 = require("../common/prisma.service");
let StockService = class StockService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getStockGroupedByCategory() {
        const categories = await this.prisma.category.findMany({
            where: { active: true },
            include: {
                products: {
                    where: { active: true },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        stock: true,
                        categoryId: true,
                    },
                    orderBy: {
                        stock: 'asc',
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
        return categories.map((category) => ({
            id: category.id,
            name: category.name,
            colorHex: category.colorHex,
            products: category.products.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                stock: product.stock,
                categoryId: product.categoryId,
            })),
        }));
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
            },
        });
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockService);

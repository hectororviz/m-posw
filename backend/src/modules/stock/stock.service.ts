import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

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

  async updateStock(productId: string, stock: number) {
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
}

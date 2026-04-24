import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async getStockGroupedByCategory() {
    // Traer todos los productos que tienen stock (SIMPLE y RAW_MATERIAL)
    const products = await this.prisma.product.findMany({
      where: { 
        active: true,
        type: { in: [ProductType.SIMPLE, ProductType.RAW_MATERIAL] },
      },
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Agrupar por categoría
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
      
      // Para materias primas, mostrar stock con decimales (hasta 4 decimales)
      // Para productos simples, mostrar enteros
      const displayStock = product.type === ProductType.RAW_MATERIAL 
        ? Math.round(product.stock * 10000) / 10000 
        : Math.floor(product.stock);
      
      categoriesMap.get(categoryId).products.push({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: displayStock,
        categoryId: product.categoryId,
        type: product.type,
      });
    }

    // Convertir a array y ordenar
    return Array.from(categoriesMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
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
        type: true,
      },
    });
  }
}

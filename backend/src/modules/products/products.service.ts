import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import type { Express } from 'express';
import { buildImageRelativePath, deleteImageFolder, saveImageFile } from '../common/image-storage';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  listActive(categoryId?: string) {
    return this.prisma.product.findMany({
      where: { 
        active: true, 
        categoryId,
        type: { not: ProductType.RAW_MATERIAL },
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
        type: ProductType.RAW_MATERIAL,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateProductDto) {
    const { ingredients, ...productData } = dto;

    // Validar que los ingredientes existan y sean RAW_MATERIAL si se proporcionan
    if (ingredients && ingredients.length > 0) {
      await this.validateIngredients(ingredients);
    }

    return this.prisma.$transaction(async (tx) => {
      // Determinar valores según el tipo de producto
      const type = productData.type ?? ProductType.SIMPLE;
      let categoryId = productData.categoryId;
      let price = productData.price;

      // Para RAW_MATERIAL, buscar o crear categoría por defecto
      if (type === ProductType.RAW_MATERIAL) {
        price = 0;
        if (!categoryId) {
          // Buscar categoría "Materias Primas" o usar la primera disponible
          let defaultCategory = await tx.category.findFirst({
            where: { name: 'Materias Primas', active: true },
          });
          if (!defaultCategory) {
            // Si no existe, usar la primera categoría activa
            defaultCategory = await tx.category.findFirst({
              where: { active: true },
              orderBy: { createdAt: 'asc' },
            });
          }
          if (!defaultCategory) {
            throw new BadRequestException('No hay categorías disponibles. Cree una categoría primero.');
          }
          categoryId = defaultCategory.id;
        }
      }

      // Validar que tengamos categoryId para tipos que lo requieren
      if (type !== ProductType.RAW_MATERIAL && !categoryId) {
        throw new BadRequestException('La categoría es requerida para este tipo de producto');
      }

      const product = await tx.product.create({
        data: {
          name: productData.name,
          price: price ?? 0,
          categoryId: categoryId!,
          type,
          iconName: productData.iconName,
          colorHex: productData.colorHex,
          active: productData.active ?? true,
        },
      });

      // Si es COMPOSITE y tiene ingredientes, crearlos
      if (type === ProductType.COMPOSITE && ingredients && ingredients.length > 0) {
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

  async update(id: string, dto: UpdateProductDto) {
    const { ingredients, ...productData } = dto;

    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
      include: {
        recipeAsComposite: true,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Validar que los ingredientes existan y sean RAW_MATERIAL si se proporcionan
    if (ingredients && ingredients.length > 0) {
      await this.validateIngredients(ingredients);
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};

      if (productData.name !== undefined) data.name = productData.name;
      if (productData.price !== undefined) data.price = productData.price;
      if (productData.categoryId !== undefined) data.categoryId = productData.categoryId;
      if (productData.iconName !== undefined) data.iconName = productData.iconName;
      if (productData.colorHex !== undefined) data.colorHex = productData.colorHex;
      if (productData.active !== undefined) data.active = productData.active;
      if (productData.type !== undefined) data.type = productData.type;

      const product = await tx.product.update({ 
        where: { id }, 
        data,
        include: {
          category: true,
        },
      });

      // Manejar ingredientes si se proporcionan
      if (ingredients !== undefined) {
        // Borrar ingredientes anteriores
        await tx.recipeIngredient.deleteMany({
          where: { compositeId: id },
        });

        // Insertar nuevos ingredientes si es COMPOSITE
        if (product.type === ProductType.COMPOSITE && ingredients.length > 0) {
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

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        saleItems: true,
        recipeAsComposite: true,
        recipeAsRawMaterial: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (product.saleItems.length > 0) {
      throw new ConflictException('Producto usado en ventas');
    }

    if (product.recipeAsRawMaterial.length > 0) {
      throw new ConflictException('No se puede eliminar: es ingrediente de otros productos');
    }

    return this.prisma.$transaction(async (tx) => {
      // Borrar ingredientes si es COMPOSITE
      if (product.recipeAsComposite.length > 0) {
        await tx.recipeIngredient.deleteMany({
          where: { compositeId: id },
        });
      }

      return tx.product.delete({ where: { id } });
    });
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    await saveImageFile('products', id, file);
    return this.prisma.product.update({
      where: { id },
      data: {
        imagePath: buildImageRelativePath('products', id),
        imageUpdatedAt: new Date(),
      },
    });
  }

  async deleteImage(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    await deleteImageFolder('products', id);
    return this.prisma.product.update({
      where: { id },
      data: {
        imagePath: null,
        imageUpdatedAt: null,
      },
    });
  }

  private async validateIngredients(ingredients: { rawMaterialId: string; quantity: number }[]) {
    const rawMaterialIds = ingredients.map(i => i.rawMaterialId);
    const rawMaterials = await this.prisma.product.findMany({
      where: {
        id: { in: rawMaterialIds },
        type: ProductType.RAW_MATERIAL,
        active: true,
      },
    });

    if (rawMaterials.length !== rawMaterialIds.length) {
      throw new BadRequestException('Uno o más ingredientes no son materias primas válidas');
    }
  }
}

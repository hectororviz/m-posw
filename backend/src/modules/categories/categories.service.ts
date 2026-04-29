import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import type { Express } from 'express';
import { buildImageRelativePath, deleteImageFolder, saveImageFile } from '../common/image-storage';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly defaultColor = '#0EA5E9';
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

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

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        ...dto,
        colorHex: dto.colorHex ?? this.defaultColor,
        active: dto.active ?? true,
      },
    });
  }

  update(id: string, dto: UpdateCategoryDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.iconName !== undefined) data.iconName = dto.iconName;
    if (dto.colorHex !== undefined) data.colorHex = dto.colorHex;
    if (dto.active !== undefined) data.active = dto.active;

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Updating category ${id} with data: ${JSON.stringify(data)}`);
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async listProducts(categoryId: string, includeInactive = false) {
    const products = await this.prisma.product.findMany({
      where: {
        categoryId,
        type: { not: ProductType.RAW_MATERIAL },
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
        recipeAsComposite: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calcular stock para productos compuestos basado en sus recetas
    return products.map(product => {
      if (product.type === ProductType.COMPOSITE && product.recipeAsComposite.length > 0) {
        // Calcular cuántas unidades se pueden hacer con el stock actual de materias primas
        const possibleUnits = product.recipeAsComposite.map(ingredient => {
          const rawMaterialStock = Number(ingredient.rawMaterial.stock);
          const quantityNeeded = Number(ingredient.quantity);
          return Math.floor(rawMaterialStock / quantityNeeded);
        });

        // El stock disponible es el mínimo de unidades posibles
        const calculatedStock = Math.min(...possibleUnits);

        return {
          ...product,
          stock: calculatedStock,
        };
      }

      // Para productos simples, devolver el stock tal cual
      return product;
    });
  }

  async remove(id: string) {
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException('No se puede borrar: tiene productos asociados');
    }
    return this.prisma.category.delete({ where: { id } });
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    await saveImageFile('categories', id, file);
    return this.prisma.category.update({
      where: { id },
      data: {
        imagePath: buildImageRelativePath('categories', id),
        imageUpdatedAt: new Date(),
      },
    });
  }

  async deleteImage(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    await deleteImageFolder('categories', id);
    return this.prisma.category.update({
      where: { id },
      data: {
        imagePath: null,
        imageUpdatedAt: null,
      },
    });
  }
}

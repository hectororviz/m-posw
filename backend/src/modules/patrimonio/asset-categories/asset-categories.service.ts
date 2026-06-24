import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AssetCategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async findOne(id: number) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.assetCategory.findUnique({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Ya existe una categoría con ese nombre');

    return this.prisma.assetCategory.create({ data: { name: dto.name } });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    if (dto.name !== undefined) {
      const existing = await this.prisma.assetCategory.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Ya existe una categoría con ese nombre');
      }
    }

    return this.prisma.assetCategory.update({
      where: { id },
      data: dto,
    });
  }

  async toggle(id: number) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    if (cat.isActive) {
      const activeAssets = await this.prisma.asset.count({
        where: { categoryId: id, isActive: true },
      });
      if (activeAssets > 0) {
        throw new BadRequestException('No se puede desactivar una categoría con bienes activos asociados');
      }
    }

    return this.prisma.assetCategory.update({
      where: { id },
      data: { isActive: !cat.isActive },
    });
  }
}

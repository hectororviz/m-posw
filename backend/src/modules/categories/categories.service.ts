import { ConflictException, Injectable, Logger } from '@nestjs/common';
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

  listProducts(categoryId: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: {
        categoryId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async remove(id: string) {
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException('No se puede borrar: tiene productos asociados');
    }
    return this.prisma.category.delete({ where: { id } });
  }
}

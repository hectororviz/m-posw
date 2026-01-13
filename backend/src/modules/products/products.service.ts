import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  listActive(categoryId?: string) {
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

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: { ...dto, active: dto.active ?? true } });
  }

  update(id: string, dto: UpdateProductDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.iconName !== undefined) data.iconName = dto.iconName;
    if (dto.colorHex !== undefined) data.colorHex = dto.colorHex;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    const saleItemCount = await this.prisma.saleItem.count({ where: { productId: id } });
    if (saleItemCount > 0) {
      throw new ConflictException('Producto usado en ventas');
    }
    return this.prisma.product.delete({ where: { id } });
  }
}

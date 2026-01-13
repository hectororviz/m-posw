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
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const saleItemCount = await this.prisma.saleItem.count({ where: { productId: id } });
    if (saleItemCount > 0) {
      throw new ConflictException('Producto usado en ventas');
    }
    return this.prisma.product.delete({ where: { id } });
  }
}

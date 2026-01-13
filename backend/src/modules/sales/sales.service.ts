import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async createSale(userId: string, dto: CreateSaleDto) {
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Producto inválido o inactivo');
    }

    const items = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = Number(product.price);
      return {
        productId: item.productId,
        quantity: item.quantity,
        subtotal: price * item.quantity,
      };
    });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return this.prisma.sale.create({
      data: {
        userId,
        total,
        items: {
          create: items,
        },
      },
      include: { items: { include: { product: true } } },
    });
  }

  listSales() {
    return this.prisma.sale.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

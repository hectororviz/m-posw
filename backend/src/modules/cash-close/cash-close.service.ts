import { Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class CashCloseService {
  constructor(private prisma: PrismaService) {}

  private round(value: Prisma.Decimal) {
    return new Prisma.Decimal(value.toDecimalPlaces(2));
  }

  private async getCurrentPeriodBounds(now: Date) {
    const lastClose = await this.prisma.cashClose.findFirst({ orderBy: { to: 'desc' } });
    if (lastClose) {
      return { from: lastClose.to, to: now };
    }

    const [firstSale, firstMovement] = await Promise.all([
      this.prisma.sale.findFirst({ select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.manualMovement.findFirst({
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const firstEvent = [firstSale?.createdAt, firstMovement?.createdAt]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return { from: firstEvent ?? now, to: now };
  }

  private async buildSummary(from: Date, to: Date) {
    const [sales, movements] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          OR: [{ status: SaleStatus.APPROVED }, { paymentStatus: PaymentStatus.APPROVED }],
        },
        select: {
          total: true,
          paymentMethod: true,
        },
      }),
      this.prisma.manualMovement.findMany({
        where: {
          createdAt: { gte: from, lte: to },
        },
        select: {
          amount: true,
          type: true,
        },
      }),
    ]);

    const salesCashTotal = sales
      .filter((sale) => sale.paymentMethod === 'CASH')
      .reduce((acc, sale) => acc.add(sale.total), ZERO);
    const salesQrTotal = sales
      .filter((sale) => sale.paymentMethod === 'MP_QR')
      .reduce((acc, sale) => acc.add(sale.total), ZERO);
    const salesTotal = salesCashTotal.add(salesQrTotal);

    const movementsOutTotal = movements
      .filter((movement) => movement.type === MovementType.SALIDA)
      .reduce((acc, movement) => acc.add(movement.amount), ZERO);
    const movementsInTotal = movements
      .filter((movement) => movement.type === MovementType.ENTRADA)
      .reduce((acc, movement) => acc.add(movement.amount), ZERO);
    const movementsNet = movementsInTotal.sub(movementsOutTotal);
    const netCashDelta = salesCashTotal.add(movementsNet);

    return {
      salesCashTotal: this.round(salesCashTotal),
      salesQrTotal: this.round(salesQrTotal),
      salesTotal: this.round(salesTotal),
      salesCount: sales.length,
      movementsOutTotal: this.round(movementsOutTotal),
      movementsInTotal: this.round(movementsInTotal),
      movementsNet: this.round(movementsNet),
      netCashDelta: this.round(netCashDelta),
      movementsCount: movements.length,
    };
  }

  async getCurrentPeriod() {
    const now = new Date();
    const { from, to } = await this.getCurrentPeriodBounds(now);
    const summary = await this.buildSummary(from, to);

    return { from, to, summary };
  }

  async closeCurrentPeriod(userId: string, note?: string) {
    const now = new Date();
    const { from, to } = await this.getCurrentPeriodBounds(now);
    const summary = await this.buildSummary(from, to);

    const cashClose = await this.prisma.cashClose.create({
      data: {
        from,
        to,
        closedAt: to,
        closedByUserId: userId,
        note: note?.trim() || null,
        ...summary,
      },
    });

    return { cashClose, from, to, summary };
  }

  async getById(id: string) {
    const cashClose = await this.prisma.cashClose.findUnique({
      where: { id },
      include: { closedBy: { select: { id: true, name: true, role: true } } },
    });
    if (!cashClose) {
      throw new NotFoundException('Cierre no encontrado');
    }
    return cashClose;
  }

  list(limit = 20, offset = 0) {
    return this.prisma.cashClose.findMany({
      include: { closedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { to: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });
  }
}

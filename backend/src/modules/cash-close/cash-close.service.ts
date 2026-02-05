import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentMethod, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CashCloseService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPeriod() {
    const now = new Date();
    const from = await this.resolveFrom(now);
    const summary = await this.buildSummary(from, now);
    return { from, to: now, summary };
  }

  async closePeriod(userId: string, note?: string) {
    const to = new Date();
    const from = await this.resolveFrom(to);
    const summary = await this.buildSummary(from, to);

    const cashClose = await this.prisma.cashClose.create({
      data: {
        from,
        to,
        closedAt: to,
        closedByUserId: userId,
        note,
        salesCashTotal: summary.salesCashTotal,
        salesQrTotal: summary.salesQrTotal,
        salesTotal: summary.salesTotal,
        salesCount: summary.salesCount,
        movementsOutTotal: summary.movementsOutTotal,
        movementsInTotal: summary.movementsInTotal,
        movementsNet: summary.movementsNet,
        netCashDelta: summary.netCashDelta,
        movementsCount: summary.movementsCount,
      },
    });

    return { cashClose, from, to, summary };
  }

  getById(id: string) {
    return this.prisma.cashClose.findUnique({ where: { id }, include: { closedBy: { select: { id: true, name: true } } } });
  }

  list(limit = 20, offset = 0) {
    return this.prisma.cashClose.findMany({
      orderBy: { to: 'desc' },
      take: Math.min(limit, 100),
      skip: Math.max(offset, 0),
      include: { closedBy: { select: { id: true, name: true } } },
    });
  }

  async getLastCloseTo() {
    const close = await this.prisma.cashClose.findFirst({ orderBy: { to: 'desc' }, select: { to: true } });
    return close?.to ?? null;
  }

  private async resolveFrom(now: Date) {
    const lastCloseTo = await this.getLastCloseTo();
    if (lastCloseTo) {
      return lastCloseTo;
    }

    const [firstSale, firstMovement] = await Promise.all([
      this.prisma.sale.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.cashMovement.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);

    const candidates = [firstSale?.createdAt, firstMovement?.createdAt].filter(Boolean) as Date[];
    if (candidates.length === 0) {
      return now;
    }
    return candidates.reduce((min, current) => (current < min ? current : min));
  }

  async buildSummary(from: Date, to: Date) {
    const saleWhere: Prisma.SaleWhereInput = {
      createdAt: { gte: from, lte: to },
      status: SaleStatus.APPROVED,
      paymentStatus: PaymentStatus.APPROVED,
    };

    const [salesAgg, salesByMethod, movementAgg, movementsByType] = await Promise.all([
      this.prisma.sale.aggregate({
        where: saleWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({ by: ['paymentMethod'], where: saleWhere, _sum: { total: true } }),
      this.prisma.cashMovement.aggregate({
        where: { createdAt: { gte: from, lte: to }, isVoided: false },
        _count: { _all: true },
      }),
      this.prisma.cashMovement.groupBy({
        by: ['type'],
        where: { createdAt: { gte: from, lte: to }, isVoided: false },
        _sum: { amount: true },
      }),
    ]);

    const salesCashTotal = this.toNumber(
      salesByMethod.find((item) => item.paymentMethod === PaymentMethod.CASH)?._sum.total,
    );
    const salesQrTotal = this.toNumber(
      salesByMethod.find((item) => item.paymentMethod === PaymentMethod.MP_QR)?._sum.total,
    );
    const movementsInTotal = this.toNumber(
      movementsByType.find((item) => item.type === 'IN')?._sum.amount,
    );
    const movementsOutTotal = this.toNumber(
      movementsByType.find((item) => item.type === 'OUT')?._sum.amount,
    );
    const movementsNet = this.round(movementsInTotal - movementsOutTotal);

    return {
      salesCashTotal,
      salesQrTotal,
      salesTotal: this.round(salesCashTotal + salesQrTotal),
      salesCount: salesAgg._count._all,
      movementsOutTotal,
      movementsInTotal,
      movementsNet,
      netCashDelta: this.round(salesCashTotal + movementsNet),
      movementsCount: movementAgg._count._all,
    };
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value == null) return 0;
    return Number(value);
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}

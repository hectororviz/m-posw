import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

interface CashSessionSummary {
  totalSalesCount: number;
  totalsByPaymentMethod: {
    CASH: number;
    QR: number;
  };
  grandTotal: number;
}

interface SummaryRow {
  paymentMethod: PaymentMethod;
  totalAmount: number;
  count: number;
}

@Injectable()
export class CashSessionService {
  constructor(private prisma: PrismaService) {}

  async getCurrent() {
    const session = await this.prisma.cashSession.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
    });
    if (!session) {
      return { open: false as const };
    }
    return { open: true as const, session };
  }

  async open(userId: string, dto: OpenCashSessionDto) {
    const existing = await this.prisma.cashSession.findFirst({ where: { closedAt: null } });
    if (existing) {
      throw new ConflictException('Ya hay una caja abierta');
    }
    try {
      return await this.prisma.cashSession.create({
        data: {
          openedByUserId: userId,
          openingFloat: dto.openingFloat,
          openingNote: dto.note,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya hay una caja abierta');
      }
      throw error;
    }
  }

  async close(userId: string, dto: CloseCashSessionDto) {
    const session = await this.prisma.cashSession.findFirst({ where: { closedAt: null } });
    if (!session) {
      throw new ConflictException('No hay una caja abierta');
    }
    const closedAt = new Date();
    const updated = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closedAt,
        closedByUserId: userId,
        closingNote: dto.note,
      },
    });
    const summary = await this.buildSummary(session.openedAt, closedAt);
    return { session: updated, summary, from: session.openedAt, to: closedAt };
  }

  async summaryBySession(sessionId: string) {
    const session = await this.prisma.cashSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Caja no encontrada');
    }
    const to = session.closedAt ?? new Date();
    const summary = await this.buildSummary(session.openedAt, to);
    return { session, summary, from: session.openedAt, to };
  }

  async buildSummary(from: Date, to: Date): Promise<CashSessionSummary> {
    const rows = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT s."paymentMethod" as "paymentMethod",
        COALESCE(SUM(s."total"), 0)::float AS "totalAmount",
        COUNT(*)::int AS "count"
      FROM "Sale" s
      WHERE s."createdAt" BETWEEN ${from} AND ${to}
        AND s."paymentStatus" = ${PaymentStatus.APPROVED}
      GROUP BY s."paymentMethod";
    `);

    const totalsByPaymentMethod = {
      CASH: 0,
      QR: 0,
    };
    let totalSalesCount = 0;
    let grandTotal = 0;

    rows.forEach((row) => {
      totalSalesCount += row.count;
      grandTotal += row.totalAmount;
      if (row.paymentMethod === PaymentMethod.CASH) {
        totalsByPaymentMethod.CASH = row.totalAmount;
      }
      if (row.paymentMethod === PaymentMethod.MP_QR) {
        totalsByPaymentMethod.QR = row.totalAmount;
      }
    });

    return { totalSalesCount, totalsByPaymentMethod, grandTotal };
  }
}

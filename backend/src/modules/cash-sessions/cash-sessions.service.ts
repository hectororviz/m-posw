import { ConflictException, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

@Injectable()
export class CashSessionsService {
  constructor(private prisma: PrismaService) {}

  private roundToCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private formatCurrency(value: number) {
    return value.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async getOpenSession() {
    return this.prisma.cashSession.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
    });
  }

  async requireOpenSession() {
    const session = await this.getOpenSession();
    if (!session) {
      throw new ConflictException('Caja cerrada');
    }
    return session;
  }

  async openSession(userId: string, dto: OpenCashSessionDto) {
    const existing = await this.getOpenSession();
    if (existing) {
      throw new ConflictException('La caja ya está abierta');
    }
    const openingFloat = this.roundToCurrency(dto.openingFloat ?? 0);
    return this.prisma.cashSession.create({
      data: {
        openedByUserId: userId,
        openingFloat,
        openingNote: dto.openingNote?.trim() || null,
      },
    });
  }

  async closeSession(userId: string) {
    const session = await this.requireOpenSession();
    const closedAt = new Date();
    const salesCashTotal = await this.getSalesCashTotal(session.openedAt, closedAt);
    const cashMovementsInTotal = await this.getCashMovementsTotal(session.id, 'IN');
    const cashMovementsOutTotal = await this.getCashMovementsTotal(session.id, 'OUT');
    const openingFloat = Number(session.openingFloat ?? 0);
    const expectedCash =
      openingFloat + salesCashTotal + cashMovementsInTotal - cashMovementsOutTotal;

    const updatedSession = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: { closedAt, closedByUserId: userId },
    });

    return {
      session: updatedSession,
      summary: {
        openingFloat,
        salesCashTotal,
        cashMovementsInTotal,
        cashMovementsOutTotal,
        expectedCash,
      },
      ticketSummary: [
        { label: 'Ingreso caja', value: this.formatCurrency(cashMovementsInTotal) },
        { label: 'Egreso caja', value: this.formatCurrency(cashMovementsOutTotal) },
        { label: 'Efectivo esperado', value: this.formatCurrency(expectedCash) },
      ],
    };
  }

  private async getSalesCashTotal(openedAt: Date, closedAt: Date) {
    const result = await this.prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.APPROVED,
        createdAt: { gte: openedAt, lte: closedAt },
      },
    });
    return Number(result._sum.total ?? 0);
  }

  private async getCashMovementsTotal(sessionId: string, type: 'IN' | 'OUT') {
    const result = await this.prisma.cashMovement.aggregate({
      _sum: { amount: true },
      where: { cashSessionId: sessionId, type, isVoided: false },
    });
    return Number(result._sum.amount ?? 0);
  }
}

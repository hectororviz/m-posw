import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class QuickExpenseService {
  constructor(private prisma: PrismaService) {}

  async listButtons() {
    return this.prisma.quickExpenseButton.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async listAllButtons() {
    return this.prisma.quickExpenseButton.findMany({
      orderBy: { position: 'asc' },
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async createButton(dto: { label: string; assetAccountId: string; expenseAccountId: string }) {
    const maxPos = await this.prisma.quickExpenseButton.aggregate({
      _max: { position: true },
    });
    return this.prisma.quickExpenseButton.create({
      data: {
        label: dto.label,
        assetAccountId: dto.assetAccountId,
        expenseAccountId: dto.expenseAccountId,
        position: (maxPos._max.position ?? 0) + 10,
      },
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateButton(id: number, dto: { label?: string; assetAccountId?: string; expenseAccountId?: string; position?: number; active?: boolean }) {
    const existing = await this.prisma.quickExpenseButton.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Botón no encontrado');

    return this.prisma.quickExpenseButton.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.assetAccountId !== undefined && { assetAccountId: dto.assetAccountId }),
        ...(dto.expenseAccountId !== undefined && { expenseAccountId: dto.expenseAccountId }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteButton(id: number) {
    const existing = await this.prisma.quickExpenseButton.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Botón no encontrado');
    return this.prisma.quickExpenseButton.delete({ where: { id } });
  }

  async submitExpense(userId: string, dto: { buttonId: number; amount: number; note?: string }) {
    const button = await this.prisma.quickExpenseButton.findUnique({
      where: { id: dto.buttonId },
    });
    if (!button) throw new NotFoundException('Botón no encontrado');

    if (dto.amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: { fiscalYear: year, month },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const seq = (lastEntry?.sequenceNumber ?? 0) + 1;

    return (this.prisma as any).journalEntry.create({
      data: {
        entryNumber: `${String(seq).padStart(5, '0')}-${String(month).padStart(2, '0')}${String(year).slice(2)}`,
        sequenceNumber: seq,
        fiscalYear: year,
        month,
        date,
        description: button.label,
        notes: dto.note || null,
        createdById: userId,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: button.expenseAccountId,
              debit: dto.amount,
              credit: 0,
              description: button.label,
            },
            {
              accountId: button.assetAccountId,
              debit: 0,
              credit: dto.amount,
              description: button.label,
            },
          ],
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }
}

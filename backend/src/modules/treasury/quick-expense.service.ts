import { Injectable, NotFoundException } from '@nestjs/common';
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
}

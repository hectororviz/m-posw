import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  CreateJournalEntryDto,
  ListJournalEntriesDto,
  SimpleEntryDto,
  UpdateJournalEntryDto,
  VoidJournalEntryDto,
} from './dto/journal-entry.dto';

export interface AutomatedEntryParams {
  date?: Date;
  description: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
  sourceType: string;
  sourceId: number;
  status?: 'DRAFT' | 'POSTED';
}

@Injectable()
export class JournalEntriesService {
  constructor(private prisma: PrismaService) {}

  async list(query: ListJournalEntriesDto) {
    const where: any = {};

    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.accountId) {
      where.lines = { some: { accountId: query.accountId } };
    }

    return this.prisma.journalEntry.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        lines: { include: { account: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
        reversalOf: {
          select: { id: true, entryNumber: true, description: true },
        },
        reversalEntry: {
          select: { id: true, entryNumber: true, description: true },
        },
      },
    });
    if (!entry) throw new NotFoundException('Asiento no encontrado');
    return entry;
  }

  async create(userId: string, dto: CreateJournalEntryDto) {
    this.validateLines(dto.lines);

    const date = new Date(dto.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    await this.validateAccounts(dto.lines);

    const entry = await this.prisma.$transaction(async (tx) => {
      const seq = await this.getNextSequence(tx, year);

      const entryNumber = this.formatEntryNumber(seq, month, year);

      return tx.journalEntry.create({
        data: {
          entryNumber,
          sequenceNumber: seq,
          fiscalYear: year,
          month,
          date,
          description: dto.description,
          notes: dto.notes,
          status: dto.status === 'POSTED' ? 'POSTED' : 'DRAFT',
          postedAt: dto.status === 'POSTED' ? new Date() : null,
          createdById: userId,
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          lines: { include: { account: true } },
        },
      });
    });

    return entry;
  }

  async createSimpleIncome(userId: string, dto: SimpleEntryDto) {
    const lines = [
      { accountId: dto.assetAccountId, debit: dto.amount, credit: 0 },
      { accountId: dto.incomeExpenseAccountId, debit: 0, credit: dto.amount },
    ];
    return this.create(userId, {
      date: dto.date,
      description: dto.description,
      notes: dto.notes,
      lines,
      status: dto.status || 'DRAFT',
    });
  }

  async createSimpleExpense(userId: string, dto: SimpleEntryDto) {
    const lines = [
      { accountId: dto.incomeExpenseAccountId, debit: dto.amount, credit: 0 },
      { accountId: dto.assetAccountId, debit: 0, credit: dto.amount },
    ];
    return this.create(userId, {
      date: dto.date,
      description: dto.description,
      notes: dto.notes,
      lines,
      status: dto.status || 'DRAFT',
    });
  }

  async update(userId: string, id: string, dto: UpdateJournalEntryDto) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Asiento no encontrado');
    if (entry.status !== 'DRAFT') {
      throw new ForbiddenException('Solo se pueden editar asientos en estado DRAFT');
    }

    if (dto.lines) {
      this.validateLines(dto.lines);
      await this.validateAccounts(dto.lines);
    }

    const data: any = {};
    if (dto.date) {
      const date = new Date(dto.date);
      data.date = date;
      data.fiscalYear = date.getFullYear();
      data.month = date.getMonth() + 1;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.journalEntryLine.deleteMany({ where: { entryId: id } });
        await tx.journalEntryLine.createMany({
          data: dto.lines.map((l) => ({
            entryId: id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        });
      }

      return tx.journalEntry.update({
        where: { id },
        data,
        include: {
          createdBy: { select: { id: true, name: true } },
          lines: { include: { account: true } },
        },
      });
    });
  }

  async delete(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Asiento no encontrado');
    if (entry.status !== 'DRAFT') {
      throw new ForbiddenException('Solo se pueden eliminar asientos en estado DRAFT');
    }
    await this.prisma.journalEntry.delete({ where: { id } });
  }

  async post(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundException('Asiento no encontrado');
    if (entry.status !== 'DRAFT') {
      throw new ForbiddenException('Solo se pueden confirmar asientos en estado DRAFT');
    }

    this.validateLines(entry.lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    })));

    return this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: {
        createdBy: { select: { id: true, name: true } },
        lines: { include: { account: true } },
      },
    });
  }

  async void(id: string, userId: string, dto: VoidJournalEntryDto) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundException('Asiento no encontrado');
    if (entry.status !== 'POSTED') {
      throw new ForbiddenException('Solo se pueden anular asientos confirmados (POSTED)');
    }
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('El motivo de anulación es obligatorio');
    }

    return this.prisma.$transaction(async (tx) => {
      const reversalLines = entry.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
        description: `Rev: ${l.description || ''}`,
      }));

      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const seq = await this.getNextSequence(tx, year);
      const entryNumber = this.formatEntryNumber(seq, month, year);

      const reversal = await tx.journalEntry.create({
        data: {
          entryNumber,
          sequenceNumber: seq,
          fiscalYear: year,
          month,
          date,
          description: `Anulación de asiento ${entry.entryNumber}: ${dto.reason}`,
          notes: dto.reason,
          status: 'POSTED',
          postedAt: new Date(),
          createdById: userId,
          reversalOfId: id,
          lines: {
            create: reversalLines as any,
          },
        },
      });

      await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: dto.reason,
        },
      });

      return reversal;
    });
  }

  async createAutomatedEntry(
    tx: Prisma.TransactionClient,
    userId: string,
    params: AutomatedEntryParams,
  ) {
    this.validateLines(params.lines);

    const date = params.date || new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const seq = await this.getNextSequence(tx, year);
    const entryNumber = this.formatEntryNumber(seq, month, year);
    const status = params.status || 'POSTED';

    return tx.journalEntry.create({
      data: {
        entryNumber,
        sequenceNumber: seq,
        fiscalYear: year,
        month,
        date,
        description: params.description,
        status,
        postedAt: status === 'POSTED' ? new Date() : null,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        createdById: userId,
        lines: {
          create: params.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
    });
  }

  private async getNextSequence(tx: Prisma.TransactionClient, fiscalYear: number): Promise<number> {
    const last = await tx.journalEntry.findFirst({
      where: { fiscalYear },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  private formatEntryNumber(seq: number, month: number, year: number): string {
    const padded = String(seq).padStart(5, '0');
    const mm = String(month).padStart(2, '0');
    const yy = String(year).slice(-2);
    return `${padded}-${mm}${yy}`;
  }

  private validateLines(lines: { accountId: string; debit: number; credit: number }[]) {
    if (!lines || lines.length < 2) {
      throw new BadRequestException('El asiento debe tener al menos dos líneas');
    }

    let hasDebit = false;
    let hasCredit = false;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;

      if (debit === 0 && credit === 0) {
        throw new BadRequestException('Cada línea debe tener un importe mayor a cero en Debe o en Haber');
      }

      if (debit > 0 && credit > 0) {
        throw new BadRequestException('Una línea no puede tener simultáneamente Debe y Haber mayores a cero');
      }

      if (debit > 0) hasDebit = true;
      if (credit > 0) hasCredit = true;

      totalDebit += debit;
      totalCredit += credit;
    }

    if (!hasDebit) {
      throw new BadRequestException('El asiento debe tener al menos una línea en el Debe');
    }

    if (!hasCredit) {
      throw new BadRequestException('El asiento debe tener al menos una línea en el Haber');
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.005) {
      throw new BadRequestException(
        `El asiento no está balanceado: Debe ${totalDebit.toFixed(2)} ≠ Haber ${totalCredit.toFixed(2)} (diferencia: ${diff.toFixed(2)})`,
      );
    }
  }

  private async validateAccounts(lines: { accountId: string }[]) {
    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { id: { in: accountIds } },
    });

    const map = new Map(accounts.map((a) => [a.id, a]));

    for (const line of lines) {
      const account = map.get(line.accountId);
      if (!account) {
        throw new BadRequestException(`Cuenta con ID ${line.accountId} no encontrada`);
      }
      if (!account.active) {
        throw new BadRequestException(`La cuenta "${account.name}" (${account.code}) está inactiva`);
      }
      if (!account.acceptsEntries) {
        throw new BadRequestException(
          `La cuenta "${account.name}" (${account.code}) es agrupadora y no acepta movimientos`,
        );
      }
    }
  }
}

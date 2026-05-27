import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateLedgerAccountDto, UpdateLedgerAccountDto } from './dto/ledger-account.dto';

@Injectable()
export class LedgerAccountsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const accounts = await this.prisma.ledgerAccount.findMany({
      include: {
        children: { orderBy: { code: 'asc' } },
        _count: { select: { lines: true } },
      },
      orderBy: { code: 'asc' },
    });

    const roots = accounts.filter((a) => !a.parentId);
    return this.buildTree(roots, accounts);
  }

  private buildTree(roots: any[], all: any[]) {
    return roots.map((root) => ({
      ...root,
      children: all
        .filter((a) => a.parentId === root.id)
        .map((child) => ({
          ...child,
          children: all.filter((a) => a.parentId === child.id),
        })),
    }));
  }

  async listFlat() {
    return this.prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { lines: true } } },
    });
  }

  async listImputable(type?: string) {
    const where: any = { acceptsEntries: true, active: true };
    if (type) where.type = type;
    return this.prisma.ledgerAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async getById(id: string) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { id },
      include: {
        children: { orderBy: { code: 'asc' } },
        _count: { select: { lines: true } },
      },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return account;
  }

  async create(dto: CreateLedgerAccountDto) {
    const existing = await this.prisma.ledgerAccount.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('El código ya existe');

    if (dto.parentId) {
      const parent = await this.prisma.ledgerAccount.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Cuenta padre no encontrada');
    }

    return this.prisma.ledgerAccount.create({ data: dto });
  }

  async update(id: string, dto: UpdateLedgerAccountDto) {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    if (dto.parentId) {
      const parent = await this.prisma.ledgerAccount.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Cuenta padre no encontrada');
      if (dto.parentId === id) throw new BadRequestException('Una cuenta no puede ser su propio padre');
    }

    return this.prisma.ledgerAccount.update({ where: { id }, data: dto });
  }

  async toggleActive(id: string) {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.ledgerAccount.update({
      where: { id },
      data: { active: !account.active },
    });
  }

  async getAssetAccountsImputable() {
    return this.prisma.ledgerAccount.findMany({
      where: { type: 'ASSET', acceptsEntries: true, active: true },
      orderBy: { code: 'asc' },
    });
  }

  async getRevenueAccountsImputable() {
    return this.prisma.ledgerAccount.findMany({
      where: { type: 'REVENUE', acceptsEntries: true, active: true },
      orderBy: { code: 'asc' },
    });
  }

  async getExpenseAccountsImputable() {
    return this.prisma.ledgerAccount.findMany({
      where: { type: 'EXPENSE', acceptsEntries: true, active: true },
      orderBy: { code: 'asc' },
    });
  }
}

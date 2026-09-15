import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  CreateMoneyAccountDto,
  CreateMoneyCategoryDto,
  CreateMoneyMovementDto,
  ListMovementsDto,
  SummaryQueryDto,
  UpdateMoneyAccountDto,
  UpdateMoneyCategoryDto,
} from './dto/finanzas.dto';

const DEFAULT_ACCOUNTS = [
  { name: 'Efectivo', kind: 'EFECTIVO' as const, position: 0 },
  { name: 'Mercado Pago', kind: 'MERCADOPAGO' as const, position: 1 },
];

const DEFAULT_CATEGORIES: Array<{ name: string; kind: 'INGRESO' | 'EGRESO' | 'AMBOS'; position: number }> = [
  { name: 'Ventas mostrador', kind: 'INGRESO', position: 0 },
  { name: 'Cuotas sociales', kind: 'INGRESO', position: 1 },
  { name: 'Cobro fiado', kind: 'INGRESO', position: 2 },
  { name: 'Compras mercadería', kind: 'EGRESO', position: 3 },
  { name: 'Servicios', kind: 'EGRESO', position: 4 },
  { name: 'Sueldos', kind: 'EGRESO', position: 5 },
  { name: 'Alquiler', kind: 'EGRESO', position: 6 },
  { name: 'Otros ingresos', kind: 'INGRESO', position: 7 },
  { name: 'Otros gastos', kind: 'EGRESO', position: 8 },
];

const round = (v: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(v.toString()).toDecimalPlaces(2);

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDayStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function parseDayEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

@Injectable()
export class FinanzasService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaults() {
    for (const a of DEFAULT_ACCOUNTS) {
      await this.prisma.moneyAccount.upsert({
        where: { name: a.name },
        create: { name: a.name, kind: a.kind, position: a.position },
        update: {},
      });
    }
    for (const c of DEFAULT_CATEGORIES) {
      await this.prisma.moneyCategory.upsert({
        where: { name: c.name },
        create: { name: c.name, kind: c.kind, position: c.position },
        update: {},
      });
    }
  }

  // ─── Cuentas ──────────────────────────────────────────────

  async listAccounts(includeInactive = false) {
    await this.ensureDefaults();
    return this.prisma.moneyAccount.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async createAccount(dto: CreateMoneyAccountDto) {
    await this.ensureDefaults();
    const position = await this.prisma.moneyAccount.count();
    return this.prisma.moneyAccount.create({
      data: {
        name: dto.name.trim(),
        kind: (dto.kind ?? 'OTRO') as never,
        initialBalance: dto.initialBalance ?? 0,
        position,
      },
    });
  }

  async updateAccount(id: string, dto: UpdateMoneyAccountDto) {
    const account = await this.prisma.moneyAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return this.prisma.moneyAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind as never } : {}),
        ...(dto.initialBalance !== undefined ? { initialBalance: dto.initialBalance } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // ─── Categorías ───────────────────────────────────────────

  async listCategories(includeInactive = false) {
    await this.ensureDefaults();
    return this.prisma.moneyCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreateMoneyCategoryDto) {
    await this.ensureDefaults();
    const position = await this.prisma.moneyCategory.count();
    return this.prisma.moneyCategory.create({
      data: { name: dto.name.trim(), kind: (dto.kind ?? 'AMBOS') as never, position },
    });
  }

  async updateCategory(id: string, dto: UpdateMoneyCategoryDto) {
    const category = await this.prisma.moneyCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return this.prisma.moneyCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind as never } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // ─── Movimientos manuales / cobros ────────────────────────

  async createMovement(userId: string | undefined, dto: CreateMoneyMovementDto) {
    const account = await this.prisma.moneyAccount.findUnique({ where: { id: dto.accountId } });
    if (!account || !account.active) throw new BadRequestException('Cuenta no válida');
    const category = await this.prisma.moneyCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category || !category.active) throw new BadRequestException('Categoría no válida');
    if (category.kind !== 'AMBOS' && category.kind !== dto.kind) {
      throw new BadRequestException(`La categoría "${category.name}" es solo de ${category.kind === 'INGRESO' ? 'ingresos' : 'egresos'}`);
    }
    return this.prisma.moneyMovement.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        kind: dto.kind as never,
        amount: round(dto.amount),
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        description: dto.description.trim(),
        source: 'MANUAL',
        userId: userId ?? null,
      },
      include: { account: true, category: true },
    });
  }

  async recordCobro(input: {
    accountId: string;
    amount: number;
    date: Date;
    description: string;
    source: 'COBRO_FIADO' | 'CUOTA_SOCIO';
    sourceId: string;
    categoryName: string;
    userId?: string;
  }) {
    await this.ensureDefaults();
    const account = await this.prisma.moneyAccount.findUnique({ where: { id: input.accountId } });
    if (!account || !account.active) throw new BadRequestException('Cuenta de cobro no válida');
    let category = await this.prisma.moneyCategory.findUnique({ where: { name: input.categoryName } });
    if (!category) {
      category = await this.prisma.moneyCategory.create({
        data: { name: input.categoryName, kind: 'INGRESO' },
      });
    }
    const existing = await this.prisma.moneyMovement.findFirst({
      where: { source: input.source as never, sourceId: input.sourceId },
    });
    if (existing) return existing;
    return this.prisma.moneyMovement.create({
      data: {
        date: input.date,
        kind: 'INGRESO',
        amount: round(input.amount),
        accountId: input.accountId,
        categoryId: category.id,
        description: input.description,
        source: input.source as never,
        sourceId: input.sourceId,
        userId: input.userId ?? null,
      },
    });
  }

  async voidMovement(id: string, reason?: string) {
    const movement = await this.prisma.moneyMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    if (movement.voidedAt) throw new BadRequestException('El movimiento ya está anulado');
    if (movement.source !== 'MANUAL') {
      throw new BadRequestException('Solo se pueden anular movimientos manuales');
    }
    return this.prisma.moneyMovement.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: reason?.trim() || null },
      include: { account: true, category: true },
    });
  }

  // ─── Ventas agregadas por día ─────────────────────────────

  private async salesByDay(from?: Date, to?: Date) {
    const sales = await this.prisma.sale.findMany({
      where: {
        ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        OR: [{ status: 'APPROVED' as never }, { paymentStatus: 'APPROVED' as never }],
        paymentMethod: { in: ['CASH', 'MP_QR', 'TRANSFER'] as never },
      },
      select: { total: true, paymentMethod: true, paidAt: true, createdAt: true, orderNumber: true },
    });
    const groups = new Map<string, { date: string; method: string; total: Prisma.Decimal; count: number }>();
    for (const s of sales) {
      const d = dayKey(s.paidAt ?? s.createdAt);
      const method = s.paymentMethod === 'CASH' ? 'CASH' : 'MP';
      const key = `${d}|${method}`;
      const g = groups.get(key) ?? { date: d, method, total: new Prisma.Decimal(0), count: 0 };
      g.total = g.total.add(s.total);
      g.count += 1;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  private async resolveSalesAccountId(method: 'CASH' | 'MP'): Promise<string | null> {
    const accounts = await this.prisma.moneyAccount.findMany({ where: { active: true } });
    if (method === 'CASH') {
      return (
        accounts.find((a) => a.kind === 'EFECTIVO')?.id ??
        accounts.find((a) => /efectivo|caja/i.test(a.name))?.id ??
        null
      );
    }
    return (
      accounts.find((a) => a.kind === 'MERCADOPAGO')?.id ??
      accounts.find((a) => /mercado/i.test(a.name))?.id ??
      null
    );
  }

  // ─── Resumen ──────────────────────────────────────────────

  async summary(query: SummaryQueryDto) {
    await this.ensureDefaults();
    const from = parseDayStart(query.from);
    const to = parseDayEnd(query.to);
    const accounts = await this.prisma.moneyAccount.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    const movements = await this.prisma.moneyMovement.findMany({
      where: {
        voidedAt: null,
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { category: true },
    });

    const daily = await this.salesByDay(from, to);
    const cashId = await this.resolveSalesAccountId('CASH');
    const mpId = await this.resolveSalesAccountId('MP');

    const totals = new Map<string, Prisma.Decimal>();
    const add = (id: string | null, v: Prisma.Decimal) => {
      if (!id) return;
      totals.set(id, (totals.get(id) ?? new Prisma.Decimal(0)).add(v));
    };
    for (const m of movements) {
      add(m.accountId, m.kind === 'INGRESO' ? new Prisma.Decimal(m.amount) : new Prisma.Decimal(m.amount).neg());
    }
    for (const g of daily) {
      add(g.method === 'CASH' ? cashId : mpId, g.total);
    }

    const balances = accounts.map((a) => {
      const delta = totals.get(a.id) ?? new Prisma.Decimal(0);
      const balance = new Prisma.Decimal(a.initialBalance).add(delta);
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        balance: Number(balance.toDecimalPlaces(2)),
      };
    });

    let income = new Prisma.Decimal(0);
    let expense = new Prisma.Decimal(0);
    const byCategory = new Map<string, { id: string; name: string; income: Prisma.Decimal; expense: Prisma.Decimal }>();
    const bumpCat = (id: string, name: string, kind: 'INGRESO' | 'EGRESO', v: Prisma.Decimal) => {
      const c = byCategory.get(id) ?? { id, name, income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) };
      if (kind === 'INGRESO') {
        c.income = c.income.add(v);
        income = income.add(v);
      } else {
        c.expense = c.expense.add(v);
        expense = expense.add(v);
      }
      byCategory.set(id, c);
    };
    for (const m of movements) {
      bumpCat(m.categoryId, m.category.name, m.kind as 'INGRESO' | 'EGRESO', new Prisma.Decimal(m.amount));
    }
    let ventasCategory = (await this.prisma.moneyCategory.findUnique({ where: { name: 'Ventas mostrador' } }))?.id ?? 'ventas';
    for (const g of daily) {
      bumpCat(ventasCategory, 'Ventas mostrador', 'INGRESO', g.total);
    }

    return {
      accounts: balances,
      totalBalance: Number(
        balances.reduce((acc, a) => acc.add(a.balance), new Prisma.Decimal(0)).toDecimalPlaces(2),
      ),
      totalIncome: Number(income.toDecimalPlaces(2)),
      totalExpense: Number(expense.toDecimalPlaces(2)),
      netResult: Number(income.sub(expense).toDecimalPlaces(2)),
      byCategory: [...byCategory.values()].map((c) => ({
        id: c.id,
        name: c.name,
        income: Number(c.income.toDecimalPlaces(2)),
        expense: Number(c.expense.toDecimalPlaces(2)),
        net: Number(c.income.sub(c.expense).toDecimalPlaces(2)),
      })),
      dailySales: daily.map((g) => ({
        date: g.date,
        method: g.method,
        accountId: g.method === 'CASH' ? cashId : mpId,
        total: Number(g.total.toDecimalPlaces(2)),
        count: g.count,
      })),
    };
  }

  // ─── Listado combinado ────────────────────────────────────

  async movements(query: ListMovementsDto) {
    await this.ensureDefaults();
    const from = parseDayStart(query.from);
    const to = parseDayEnd(query.to);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);

    const where: Prisma.MoneyMovementWhereInput = {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? { description: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.moneyMovement.findMany({
        where,
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.moneyMovement.count({ where }),
    ]);

    const items = rows.map((m) => ({
      id: m.id,
      date: m.date,
      kind: m.kind,
      description: m.description,
      categoryId: m.categoryId,
      categoryName: m.category.name,
      accountId: m.accountId,
      accountName: m.account.name,
      amountIn: m.kind === 'INGRESO' ? Number(m.amount) : 0,
      amountOut: m.kind === 'EGRESO' ? Number(m.amount) : 0,
      source: m.source,
      salesCount: 0,
      voided: m.voidedAt !== null,
    }));

    // Ventas diarias como filas virtuales (solo si no hay filtro de categoría manual)
    let dailyRows: typeof items = [];
    if (!query.categoryId && !query.search) {
      const daily = await this.salesByDay(from, to);
      const cashId = await this.resolveSalesAccountId('CASH');
      const mpId = await this.resolveSalesAccountId('MP');
      const accounts = await this.prisma.moneyAccount.findMany();
      const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
      dailyRows = daily
        .filter((g) => {
          const aid = g.method === 'CASH' ? cashId : mpId;
          return query.accountId ? aid === query.accountId : true;
        })
        .map((g) => {
          const aid = g.method === 'CASH' ? cashId : mpId;
          return {
            id: `venta-${g.date}-${g.method}`,
            date: new Date(`${g.date}T12:00:00.000Z`),
            kind: 'INGRESO' as const,
            description: `Ventas del día ${g.method === 'CASH' ? 'en efectivo' : 'Mercado Pago'} (${g.count})`,
            categoryId: '',
            categoryName: 'Ventas mostrador',
            accountId: aid ?? '',
            accountName: nameOf(aid),
            amountIn: Number(g.total.toDecimalPlaces(2)),
            amountOut: 0,
            source: 'VENTA_DIARIA' as never,
            salesCount: g.count,
            voided: false,
          };
        });
    }

    const combined = [...items, ...dailyRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      data: combined.slice((page - 1) * limit, page * limit),
      total: total + dailyRows.length,
      page,
      limit,
    };
  }
}

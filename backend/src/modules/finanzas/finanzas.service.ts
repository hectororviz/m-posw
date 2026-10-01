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

const DEFAULT_CATEGORIES: Array<{ name: string; kind: 'INGRESO' | 'EGRESO' | 'AMBOS'; grupo: string; position: number }> = [
  { name: 'Ventas mostrador', kind: 'INGRESO', grupo: 'OPERATIVO', position: 0 },
  { name: 'Cuotas sociales', kind: 'INGRESO', grupo: 'OPERATIVO', position: 1 },
  { name: 'Cobro fiado', kind: 'INGRESO', grupo: 'OPERATIVO', position: 2 },
  { name: 'Comida', kind: 'EGRESO', grupo: 'OPERATIVO', position: 3 },
  { name: 'Bebidas', kind: 'AMBOS', grupo: 'OPERATIVO', position: 4 },
  { name: 'Transporte', kind: 'AMBOS', grupo: 'OPERATIVO', position: 5 },
  { name: 'Insumos', kind: 'EGRESO', grupo: 'OPERATIVO', position: 6 },
  { name: 'Materiales', kind: 'EGRESO', grupo: 'OPERATIVO', position: 7 },
  { name: 'Indumentaria', kind: 'AMBOS', grupo: 'OPERATIVO', position: 8 },
  { name: 'Árbitros', kind: 'EGRESO', grupo: 'OPERATIVO', position: 9 },
  { name: 'Administración', kind: 'AMBOS', grupo: 'OPERATIVO', position: 10 },
  { name: 'Servicios', kind: 'EGRESO', grupo: 'OPERATIVO', position: 11 },
  { name: 'Torneos', kind: 'AMBOS', grupo: 'OPERATIVO', position: 12 },
  { name: 'Cta Cte.', kind: 'AMBOS', grupo: 'OPERATIVO', position: 13 },
  { name: 'Compras mercadería', kind: 'EGRESO', grupo: 'OPERATIVO', position: 14 },
  { name: 'Préstamos', kind: 'AMBOS', grupo: 'FINANCIERO', position: 15 },
  { name: 'Intereses', kind: 'EGRESO', grupo: 'FINANCIERO', position: 16 },
  { name: 'Cambio Caja', kind: 'AMBOS', grupo: 'FINANCIERO', position: 17 },
  { name: 'Otros ingresos', kind: 'INGRESO', grupo: 'OPERATIVO', position: 18 },
  { name: 'Otros gastos', kind: 'EGRESO', grupo: 'OPERATIVO', position: 19 },
  { name: 'Otros', kind: 'AMBOS', grupo: 'OPERATIVO', position: 20 },
];

const DEFAULT_RESPONSABLES = ['Luis', 'Belén', 'Fernanda', 'Héctor'];

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
        create: { name: c.name, kind: c.kind, grupo: c.grupo, position: c.position },
        update: {},
      });
    }
    for (const nombre of DEFAULT_RESPONSABLES) {
      await this.prisma.responsable.upsert({
        where: { nombre },
        create: { nombre },
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
      data: {
        name: dto.name.trim(),
        kind: (dto.kind ?? 'AMBOS') as never,
        grupo: ((dto as { grupo?: string }).grupo === 'FINANCIERO' ? 'FINANCIERO' : 'OPERATIVO'),
        position,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateMoneyCategoryDto) {
    const category = await this.prisma.moneyCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    if (dto.active === false) {
      const inUse = await this.prisma.moneyMovement.count({ where: { categoryId: id } });
      if (inUse > 0) throw new BadRequestException('La categoría tiene movimientos asociados');
    }
    return this.prisma.moneyCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind as never } : {}),
        ...(((dto as { grupo?: string }).grupo === 'OPERATIVO' || (dto as { grupo?: string }).grupo === 'FINANCIERO') ? { grupo: (dto as { grupo?: string }).grupo } : {}),
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
    let responsableId: string | null = null;
    if ((dto as { responsableId?: string }).responsableId) {
      const r = await this.prisma.responsable.findUnique({ where: { id: (dto as { responsableId?: string }).responsableId! } });
      if (!r || !r.active) throw new BadRequestException('Responsable no válido');
      responsableId = r.id;
    }
    return this.prisma.moneyMovement.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        kind: dto.kind as never,
        amount: round(dto.amount),
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        concepto: ((dto as { concepto?: string }).concepto ?? dto.description).trim().slice(0, 120),
        description: dto.description.trim(),
        observaciones: (dto as { observaciones?: string }).observaciones?.trim() || null,
        responsableId,
        source: 'MANUAL',
        userId: userId ?? null,
      },
      include: { account: true, category: true, responsable: true },
    });
  }

  // ─── Venta → entrada automática (idempotente source=VENTA/sourceId=sale.id) ──
  async recordVenta(saleId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return null;
    if (sale.paymentMethod === 'FIADO') return null;
    if (sale.status !== 'APPROVED' && sale.paymentStatus !== 'APPROVED') return null;
    const existing = await this.prisma.moneyMovement.findFirst({
      where: { source: 'VENTA' as never, sourceId: sale.id },
    });
    if (existing) return existing;
    await this.ensureDefaults();
    const method = sale.paymentMethod === 'CASH' ? 'CASH' : 'MP';
    const accountId = await this.resolveSalesAccountId(method);
    if (!accountId) return null;
    let category = await this.prisma.moneyCategory.findUnique({ where: { name: 'Ventas mostrador' } });
    if (!category) {
      category = await this.prisma.moneyCategory.create({ data: { name: 'Ventas mostrador', kind: 'INGRESO' } });
    }
    return this.prisma.moneyMovement.create({
      data: {
        date: sale.paidAt ?? sale.createdAt,
        kind: 'INGRESO',
        amount: sale.total as never,
        accountId,
        categoryId: category.id,
        concepto: `Venta #${sale.orderNumber}`,
        description: `Venta #${sale.orderNumber} (${sale.paymentMethod === 'CASH' ? 'efectivo' : 'Mercado Pago'})`,
        source: 'VENTA' as never,
        sourceId: sale.id,
      },
    });
  }

  async voidVenta(saleId: string, reason?: string) {
    const entry = await this.prisma.moneyMovement.findFirst({
      where: { source: 'VENTA' as never, sourceId: saleId, voidedAt: null },
    });
    if (!entry) return null;
    return this.prisma.moneyMovement.update({
      where: { id: entry.id },
      data: { voidedAt: new Date(), voidReason: reason ?? 'Venta anulada/reembolsada' },
    });
  }

  async backfillVentas(since?: string) {
    const from = since ? new Date(since) : new Date('2026-09-01T03:00:00Z');
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: from },
        paymentMethod: { in: ['CASH', 'MP_QR', 'TRANSFER'] as never },
        OR: [{ status: 'APPROVED' as never }, { paymentStatus: 'APPROVED' as never }],
      },
      select: { id: true },
      take: 2000,
    });
    let created = 0;
    for (const s of sales) {
      const r = await this.recordVenta(s.id);
      if (r && (r as { createdAt?: Date })) created += 1;
    }
    const count = await this.prisma.moneyMovement.count({ where: { source: 'VENTA' as never } });
    return { evaluadas: sales.length, entradasVenta: count };
  }

  // ─── Traspaso interno (par EGRESO/INGRESO con mismo transferGroupId) ──
  async createTraspaso(userId: string | undefined, dto: { fromAccountId: string; toAccountId: string; amount: number; date?: string; responsableId?: string; observaciones?: string }) {
    if (dto.fromAccountId === dto.toAccountId) throw new BadRequestException('Origen y destino deben diferir');
    if (!dto.amount || dto.amount <= 0) throw new BadRequestException('Monto mayor a 0');
    const [from, to] = await Promise.all([
      this.prisma.moneyAccount.findUnique({ where: { id: dto.fromAccountId } }),
      this.prisma.moneyAccount.findUnique({ where: { id: dto.toAccountId } }),
    ]);
    if (!from?.active || !to?.active) throw new BadRequestException('Cuenta no válida');
    await this.ensureDefaults();
    let category = await this.prisma.moneyCategory.findUnique({ where: { name: 'Cambio Caja' } });
    if (!category) category = await this.prisma.moneyCategory.create({ data: { name: 'Cambio Caja', kind: 'AMBOS' } });
    const groupId = `traspaso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const date = dto.date ? new Date(dto.date) : new Date();
    const out = await this.prisma.moneyMovement.create({
      data: {
        date, kind: 'EGRESO', amount: round(dto.amount), accountId: from.id, categoryId: category.id,
        concepto: `Traspaso a ${to.name}`, description: `Traspaso a ${to.name}`,
        observaciones: dto.observaciones?.trim() || null, responsableId: dto.responsableId ?? null,
        transferGroupId: groupId, source: 'TRASPASO' as never, userId: userId ?? null,
      },
    });
    await this.prisma.moneyMovement.create({
      data: {
        date, kind: 'INGRESO', amount: round(dto.amount), accountId: to.id, categoryId: category.id,
        concepto: `Traspaso desde ${from.name}`, description: `Traspaso desde ${from.name}`,
        observaciones: dto.observaciones?.trim() || null, responsableId: dto.responsableId ?? null,
        transferGroupId: groupId, source: 'TRASPASO' as never, userId: userId ?? null,
      },
    });
    return { groupId, egresoId: out.id };
  }

  // ─── Responsables ABM ──
  async listResponsables(includeInactive = false) {
    await this.ensureDefaults();
    return this.prisma.responsable.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async createResponsable(nombre: string) {
    const clean = nombre.trim().slice(0, 60);
    if (!clean) throw new BadRequestException('Nombre requerido');
    await this.ensureDefaults();
    return this.prisma.responsable.upsert({ where: { nombre: clean }, create: { nombre: clean }, update: {} });
  }

  async toggleResponsable(id: string) {
    const r = await this.prisma.responsable.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Responsable no encontrado');
    if (r.active) {
      const inUse = await this.prisma.moneyMovement.count({ where: { responsableId: id } });
      if (inUse > 0) throw new BadRequestException('Tiene movimientos asociados, no se puede desactivar');
    }
    return this.prisma.responsable.update({ where: { id }, data: { active: !r.active } });
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
    if (movement.source !== 'MANUAL' && movement.source !== 'TRASPASO') {
      throw new BadRequestException('Solo se pueden anular movimientos manuales o traspasos');
    }
    if (movement.source === 'TRASPASO' && movement.transferGroupId) {
      await this.prisma.moneyMovement.updateMany({
        where: { transferGroupId: movement.transferGroupId, voidedAt: null },
        data: { voidedAt: new Date(), voidReason: reason?.trim() || null },
      });
    }
    return this.prisma.moneyMovement.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: reason?.trim() || null },
      include: { account: true, category: true },
    });
  }

  // ─── Resumen mensual (cortes por mes) ──
  async monthly(year: number) {
    await this.ensureDefaults();
    const rows = await this.prisma.moneyMovement.findMany({
      where: {
        voidedAt: null,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { date: true, kind: true, amount: true, accountId: true },
    });
    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const m of rows) {
      const key = m.date.toISOString().slice(0, 7);
      const e = byMonth.get(key) ?? { income: 0, expense: 0 };
      if (m.kind === 'INGRESO') e.income += Number(m.amount);
      else e.expense += Number(m.amount);
      byMonth.set(key, e);
    }
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, v]) => ({ month, income: Math.round(v.income * 100) / 100, expense: Math.round(v.expense * 100) / 100, net: Math.round((v.income - v.expense) * 100) / 100 }));
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
    let operativoIncome = new Prisma.Decimal(0);
    let operativoExpense = new Prisma.Decimal(0);
    for (const m of movements) {
      const grupo = (m.category as { grupo?: string }).grupo ?? 'OPERATIVO';
      bumpCat(m.categoryId, m.category.name, m.kind as 'INGRESO' | 'EGRESO', new Prisma.Decimal(m.amount));
      if (grupo !== 'FINANCIERO') {
        if (m.kind === 'INGRESO') operativoIncome = operativoIncome.add(new Prisma.Decimal(m.amount));
        else operativoExpense = operativoExpense.add(new Prisma.Decimal(m.amount));
      }
    }

    return {
      accounts: balances,
      totalBalance: Number(
        balances.reduce((acc, a) => acc.add(a.balance), new Prisma.Decimal(0)).toDecimalPlaces(2),
      ),
      totalIncome: Number(income.toDecimalPlaces(2)),
      totalExpense: Number(expense.toDecimalPlaces(2)),
      netResult: Number(income.sub(expense).toDecimalPlaces(2)),
      operativoIncome: Number(operativoIncome.toDecimalPlaces(2)),
      operativoExpense: Number(operativoExpense.toDecimalPlaces(2)),
      operativoNet: Number(operativoIncome.sub(operativoExpense).toDecimalPlaces(2)),
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

  private async buildDailyRows(from?: Date, to?: Date, accountId?: string) {
    const daily = await this.salesByDay(from, to);
    const cashId = await this.resolveSalesAccountId('CASH');
    const mpId = await this.resolveSalesAccountId('MP');
    const accounts = await this.prisma.moneyAccount.findMany();
    const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
    return daily
      .filter((g) => {
        const aid = g.method === 'CASH' ? cashId : mpId;
        return accountId ? aid === accountId : true;
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

  async categoryDetail(categoryId: string, query: ListMovementsDto) {
    await this.ensureDefaults();
    const category = await this.prisma.moneyCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Rubro no encontrado');

    const sum = await this.summary({ from: query.from, to: query.to });
    const catSum = sum.byCategory.find((c) => c.id === categoryId);

    const list = await this.movements({ ...query, categoryId });

    return {
      category: { id: category.id, name: category.name, kind: category.kind },
      totals: {
        income: catSum?.income ?? 0,
        expense: catSum?.expense ?? 0,
        net: catSum?.net ?? 0,
        count: list.total,
      },
      movements: list,
    };
  }

  // ─── Listado combinado ────────────────────────────────────

  async movements(query: ListMovementsDto & { source?: string; responsableId?: string; groupVentas?: string }) {
    await this.ensureDefaults();
    const from = parseDayStart(query.from);
    const to = parseDayEnd(query.to);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);

    const where: Prisma.MoneyMovementWhereInput = {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...((query as { source?: string }).source ? { source: (query as { source?: string }).source as never } : {}),
      ...((query as { responsableId?: string }).responsableId ? { responsableId: (query as { responsableId?: string }).responsableId } : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { concepto: { contains: query.search, mode: 'insensitive' } },
              { observaciones: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.moneyMovement.findMany({
        where,
        include: { account: true, category: true, responsable: true },
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
      concepto: (m as { concepto?: string }).concepto ?? m.description,
      description: m.description,
      observaciones: (m as { observaciones?: string | null }).observaciones ?? null,
      responsableId: (m as { responsableId?: string | null }).responsableId ?? null,
      responsableNombre: (m as { responsable?: { nombre?: string } | null }).responsable?.nombre ?? null,
      transferGroupId: (m as { transferGroupId?: string | null }).transferGroupId ?? null,
      categoryId: m.categoryId,
      categoryName: m.category.name,
      categoryGrupo: (m.category as { grupo?: string }).grupo ?? 'OPERATIVO',
      accountId: m.accountId,
      accountName: m.account.name,
      amountIn: m.kind === 'INGRESO' ? Number(m.amount) : 0,
      amountOut: m.kind === 'EGRESO' ? Number(m.amount) : 0,
      source: m.source,
      sourceId: m.sourceId,
      salesCount: 0,
      voided: m.voidedAt !== null,
    }));

    // Grupos colapsables de ventas (VENTA agrupada por día+cuenta, hijos vía source=VENTA&from&to)
    if ((query as { groupVentas?: string }).groupVentas === '1' && !query.search && !query.categoryId && !(query as { source?: string }).source) {
      const groups = new Map<string, { date: string; accountId: string; accountName: string; count: number; total: number }>();
      const ventas = items.filter((i) => i.source === 'VENTA' && !i.voided);
      for (const v of ventas) {
        const key = `${new Date(v.date).toISOString().slice(0, 10)}|${v.accountId}`;
        const g = groups.get(key) ?? { date: new Date(v.date).toISOString().slice(0, 10), accountId: v.accountId, accountName: v.accountName, count: 0, total: 0 };
        g.count += 1;
        g.total = Math.round((g.total + v.amountIn) * 100) / 100;
        groups.set(key, g);
      }
      const rest = items.filter((i) => !(i.source === 'VENTA' && !i.voided));
      const groupRows = [...groups.values()].map((g) => ({
        id: `grupo-venta-${g.date}-${g.accountId}`,
        date: new Date(`${g.date}T12:00:00.000Z`),
        kind: 'INGRESO' as const,
        concepto: `Ventas del día (${g.count})`,
        description: `Ventas del día (${g.count})`,
        observaciones: null,
        responsableId: null,
        responsableNombre: null,
        transferGroupId: null,
        categoryId: '',
        categoryName: 'Ventas mostrador',
        categoryGrupo: 'OPERATIVO',
        accountId: g.accountId,
        accountName: g.accountName,
        amountIn: g.total,
        amountOut: 0,
        source: 'VENTA_GRUPO' as never,
        sourceId: g.date as unknown as string,
        salesCount: g.count,
        voided: false,
      }));
      const combined = [...rest, ...groupRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      return { data: combined, total, page, limit };
    }

    return { data: items, total, page, limit };
  }
}

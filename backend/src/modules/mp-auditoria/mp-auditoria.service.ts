import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { MercadoPagoConfigService } from '../common/mp-config.service';
import { FinanzasService } from '../finanzas/finanzas.service';
import { ListMpMovementsDto } from './dto/mp-auditoria.dto';

const DEFAULT_SETTING_ID = '941abb3e-8bf2-4f08-b443-b3c98bd0b5ca';
const CUTOVER_ISO = '2026-10-01T03:00:00.000Z';

interface MPPayment {
  id: string | number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  transaction_details?: { net_received_amount?: number; total_paid_amount?: number };
  fee_details?: Array<{ type?: string; amount?: number }>;
  payer?: { first_name?: string; last_name?: string; email?: string };
  payment_method_id?: string;
  payment_type_id?: string;
  operation_type?: string;
  money_release_status?: string;
  external_reference?: string;
  order?: { merchant_order_id?: number | string };
  date_created?: string;
  date_approved?: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function parseDayStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseDayEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function classify(p: MPPayment): string {
  if (p.status === 'refunded') return 'REFUND';
  if (p.status === 'charged_back' || p.status === 'chargeback') return 'CHARGEBACK';
  if (p.operation_type === 'money_transfer' || p.payment_method_id === 'cvu') return 'TRANSFERENCIA';
  if (p.operation_type === 'regular_payment' || p.payment_type_id === 'credit_card' || p.payment_type_id === 'debit_card' || p.payment_type_id === 'ticket' || p.payment_type_id === 'account_money') return 'COBRO_QR';
  if (p.operation_type === 'money_withdraw' || p.operation_type === 'payout') return 'RETIRO';
  return 'OTRO';
}

@Injectable()
export class MpAuditoriaService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly logger = new Logger(MpAuditoriaService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private mpConfig: MercadoPagoConfigService,
    private finanzas: FinanzasService,
  ) {}

  private async getAuditConfig() {
    const s = await this.prisma.setting.findUnique({ where: { id: DEFAULT_SETTING_ID } });
    const since = (s as { mpAuditSince?: Date | null } | null)?.mpAuditSince ?? new Date(CUTOVER_ISO);
    const enabled = (s as { mpAuditEnabled?: boolean } | null)?.mpAuditEnabled ?? true;
    const cursor = (s as { mpAuditCursor?: Date | null } | null)?.mpAuditCursor ?? null;
    return { since, enabled, cursor };
  }

  // ─── Cron horario ──
  @Cron('0 * * * *')
  async cronHourly() {
    try {
      const { enabled } = await this.getAuditConfig();
      if (!enabled) return;
      await this.syncIncremental();
    } catch (e) {
      this.logger.warn(`MP audit cron failed: ${e}`);
    }
  }

  private headers(token: string): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (process.env.MP_INTEGRATOR_ID) h['X-Integrator-Id'] = process.env.MP_INTEGRATOR_ID;
    return h;
  }

  private async fetchPayments(headers: Record<string, string>, beginISO: string, endISO: string, offset = 0): Promise<MPPayment[]> {
    const url = new URL(`${this.baseUrl}/v1/payments/search`);
    url.searchParams.append('range', 'date_created');
    url.searchParams.append('begin_date', beginISO);
    url.searchParams.append('end_date', endISO);
    url.searchParams.append('sort', 'date_created');
    url.searchParams.append('criteria', 'desc');
    url.searchParams.append('limit', '50');
    url.searchParams.append('offset', String(offset));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url.toString(), { headers, signal: controller.signal });
      const data = (await res.json()) as { results?: MPPayment[] };
      if (!res.ok) throw new Error(`MP API ${res.status}`);
      return data.results || [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async upsertPayment(p: MPPayment) {
    const mpPaymentId = String(p.id);
    const bruto = round2(p.transaction_amount ?? 0);
    const fee = round2((p.fee_details || []).reduce((a, f) => a + (f.amount ?? 0), 0));
    const neto = round2(p.transaction_details?.net_received_amount ?? bruto - fee);
    const payer = p.payer ? [p.payer.first_name, p.payer.last_name].filter(Boolean).join(' ') || null : null;
    const tipo = classify(p);
    const fechaMp = new Date(p.date_approved || p.date_created || new Date().toISOString());
    const created = await this.prisma.mpAccountMovement.upsert({
      where: { mpPaymentId },
      create: {
        mpPaymentId, tipo: tipo as never, montoBruto: bruto, fee, montoNeto: neto,
        pagador: payer, email: p.payer?.email ?? null,
        externalRef: p.external_reference ?? null,
        merchantOrderId: p.order?.merchant_order_id != null ? String(p.order.merchant_order_id) : null,
        fechaMp, raw: p as never,
      },
      update: {
        montoBruto: bruto, fee, montoNeto: neto, pagador: payer,
        email: p.payer?.email ?? null, externalRef: p.external_reference ?? null,
        fechaMp, raw: p as never,
      },
    });
    await this.autoMatch(created.id);
    return created;
  }

  // Auto-match: externalRef sale-/ticket- / mpPaymentId en Sale / monto+fecha cercano
  private async autoMatch(mpId: string) {
    const mp = await this.prisma.mpAccountMovement.findUnique({ where: { id: mpId }, include: { conciliaciones: true } });
    if (!mp || (mp.estado !== 'PENDIENTE' && mp.estado !== 'SUGERIDO') || mp.conciliaciones.length > 0) return;
    const ext = mp.externalRef || '';
    if (ext.startsWith('sale-')) {
      const saleId = ext.slice(5);
      const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
      if (sale) {
        await this.link(mpId, { saleId, monto: Number(mp.montoNeto) });
        return;
      }
    }
    if (ext.startsWith('ticket-')) {
      await this.prisma.mpAccountMovement.update({ where: { id: mpId }, data: { estado: 'CONCILIADO' } });
      return;
    }
    const byPayment = await this.prisma.sale.findFirst({ where: { mpPaymentId: mp.mpPaymentId } });
    if (byPayment) {
      await this.link(mpId, { saleId: byPayment.id, monto: Number(mp.montoNeto) });
      return;
    }
    // Transferencias: el paymentId vive en MovimientoMP (Sale.mpPaymentId queda null)
    const byMovimiento = await this.prisma.movimientoMP.findUnique({
      where: { paymentId: mp.mpPaymentId },
      select: { saleId: true },
    });
    if (byMovimiento?.saleId) {
      await this.link(mpId, { saleId: byMovimiento.saleId, monto: Number(mp.montoNeto) });
      return;
    }
    // Sugerencia por monto + ventana ±3 días contra ventas MP_QR/TRANSFER sin conciliar
    const window = { gte: new Date(mp.fechaMp.getTime() - 3 * 864e5), lte: new Date(mp.fechaMp.getTime() + 3 * 864e5) };
    const candidates = await this.prisma.sale.findMany({
      where: {
        paymentMethod: { in: ['MP_QR', 'TRANSFER'] as never },
        total: { gte: new Prisma.Decimal(Number(mp.montoNeto) - 0.05), lte: new Prisma.Decimal(Number(mp.montoNeto) + 0.05) },
        OR: [{ paidAt: window }, { paidAt: null, createdAt: window }],
      },
      take: 5,
      select: { id: true },
    });
    const used = candidates.length
      ? await this.prisma.mpConciliacion.findMany({ where: { saleId: { in: candidates.map((c) => c.id) } }, select: { saleId: true } })
      : [];
    const usedIds = new Set(used.map((u) => u.saleId));
    const free = candidates.filter((c) => !usedIds.has(c.id));
    if (free.length === 1) {
      await this.prisma.mpAccountMovement.update({ where: { id: mpId }, data: { estado: 'SUGERIDO', nota: `Sugerido: venta ${free[0].id.slice(0, 8)}` } });
    }
  }

  private async link(mpId: string, opts: { saleId?: string; moneyMovementId?: string; monto: number }) {
    await this.prisma.mpConciliacion.create({
      data: {
        mpMovementId: mpId,
        saleId: opts.saleId ?? null,
        moneyMovementId: opts.moneyMovementId ?? null,
        montoAsignado: opts.monto,
      },
    });
    await this.prisma.mpAccountMovement.update({
      where: { id: mpId },
      data: { estado: 'CONCILIADO', conciliadoAt: new Date() },
    });
  }

  // ─── Reconciliación masiva: corre autoMatch sobre todo lo pendiente ──
  async reconcileAll() {
    if (this.running) throw new BadRequestException('Ya hay una sincronización en curso');
    this.running = true;
    try {
      let vinculados = 0;
      let sugeridos = 0;
      const PAGE = 200;
      for (;;) {
        const batch = await this.prisma.mpAccountMovement.findMany({
          where: { estado: { in: ['PENDIENTE', 'SUGERIDO'] as never } },
          select: { id: true },
          take: PAGE,
        });
        if (batch.length === 0) break;
        for (const m of batch) {
          const before = await this.prisma.mpAccountMovement.findUnique({
            where: { id: m.id },
            select: { estado: true },
          });
          await this.autoMatch(m.id);
          const after = await this.prisma.mpAccountMovement.findUnique({
            where: { id: m.id },
            select: { estado: true },
          });
          if (before?.estado !== after?.estado) {
            if (after?.estado === 'CONCILIADO') vinculados += 1;
            if (after?.estado === 'SUGERIDO') sugeridos += 1;
          }
        }
        if (batch.length < PAGE) break;
      }
      const pendientes = await this.prisma.mpAccountMovement.count({
        where: { estado: { in: ['PENDIENTE', 'SUGERIDO'] as never } },
      });
      return { vinculados, sugeridos, pendientes };
    } finally {
      this.running = false;
    }
  }

  // ─── Sync incremental (cursor) ──
  async syncIncremental() {
    if (this.running) return { skipped: true };
    const token = await this.mpConfig.getAccessToken();
    if (!token) throw new BadRequestException('MP access token no configurado');
    const { since, cursor } = await this.getAuditConfig();
    const now = new Date();
    const from = cursor ?? since;
    if (now.getTime() - from.getTime() <= 0) return { nuevos: 0 };
    this.running = true;
    try {
      const h = this.headers(token);
      let offset = 0;
      let nuevos = 0;
      for (let page = 0; page < 6; page++) {
        const batch = await this.fetchPayments(h, from.toISOString(), now.toISOString(), offset);
        for (const p of batch) {
          if (p.status !== 'approved' && p.status !== 'refunded' && p.status !== 'charged_back') continue;
          await this.upsertPayment(p);
          nuevos += 1;
        }
        if (batch.length < 50) break;
        offset += 50;
      }
      await this.prisma.setting.updateMany({ data: { mpAuditCursor: now } });
      return { nuevos, desde: from, hasta: now };
    } finally {
      this.running = false;
    }
  }

  // ─── Backfill histórico por semanas (corte 01/09/26) ──
  async backfill(sinceISO?: string) {
    if (this.running) throw new BadRequestException('Ya hay una sincronización en curso');
    const token = await this.mpConfig.getAccessToken();
    if (!token) throw new BadRequestException('MP access token no configurado');
    const since = sinceISO ? new Date(sinceISO) : new Date(CUTOVER_ISO);
    const until = new Date();
    const job = await this.prisma.mpSyncJob.create({ data: { since, until, status: 'RUNNING' } });
    this.running = true;
    try {
      const h = this.headers(token);
      const WEEK = 7 * 864e5;
      let nuevos = 0;
      for (let start = since.getTime(); start < until.getTime(); start += WEEK) {
        const end = new Date(Math.min(start + WEEK, until.getTime()));
        let offset = 0;
        for (let page = 0; page < 10; page++) {
          const batch = await this.fetchPayments(h, new Date(start).toISOString(), end.toISOString(), offset);
          for (const p of batch) {
            if (p.status !== 'approved' && p.status !== 'refunded' && p.status !== 'charged_back') continue;
            await this.upsertPayment(p);
            nuevos += 1;
          }
          if (batch.length < 50) break;
          offset += 50;
        }
        await this.prisma.mpSyncJob.update({ where: { id: job.id }, data: { offset: nuevos, detail: `hasta ${end.toISOString().slice(0, 10)}: ${nuevos}` } });
      }
      await this.prisma.setting.updateMany({ data: { mpAuditSince: since, mpAuditCursor: until } });
      await this.prisma.mpSyncJob.update({ where: { id: job.id }, data: { status: 'DONE', offset: nuevos, detail: `total ${nuevos}` } });
      return { jobId: job.id, nuevos, desde: since, hasta: until };
    } catch (e) {
      await this.prisma.mpSyncJob.update({ where: { id: job.id }, data: { status: 'FAILED', detail: String(e).slice(0, 300) } });
      throw e;
    } finally {
      this.running = false;
    }
  }

  async syncStatus() {
    const job = await this.prisma.mpSyncJob.findFirst({ orderBy: { createdAt: 'desc' } });
    const s = await this.prisma.setting.findFirst({ select: { mpAuditSince: true, mpAuditCursor: true, mpBalanceCached: true, mpBalanceAt: true, mpDisponible: true, mpDisponibleAt: true, lastOutflowSyncAt: true } });
    const pendientes = await this.prisma.mpAccountMovement.count({ where: { estado: { in: ['PENDIENTE', 'SUGERIDO'] as never } } });
    return {
      job,
      since: (s as { mpAuditSince?: Date | null })?.mpAuditSince ?? null,
      cursor: (s as { mpAuditCursor?: Date | null })?.mpAuditCursor ?? null,
      pendientes,
      balance: (s as { mpBalanceCached?: unknown })?.mpBalanceCached != null ? Number((s as { mpBalanceCached?: unknown }).mpBalanceCached as number) : null,
      balanceAt: (s as { mpBalanceAt?: Date | null })?.mpBalanceAt ?? null,
      disponible: (s as { mpDisponible?: unknown })?.mpDisponible != null ? Number((s as { mpDisponible?: unknown }).mpDisponible as number) : null,
      disponibleAt: (s as { mpDisponibleAt?: Date | null })?.mpDisponibleAt ?? null,
      lastOutflowSyncAt: (s as { lastOutflowSyncAt?: Date | null })?.lastOutflowSyncAt ?? null,
      running: this.running,
    };
  }

  // ─── Saldo MP según sistema ──
  // NOTA: la API pública de MP no expone saldo con este OAuth
  // (/v1/account/balance → 404, /users/.../mercadopago-accounts → 403 sin permiso
  // especial). Se calcula desde los movimientos registrados.
  async balance() {
    await this.finanzas.ensureDefaults();
    const account = await this.prisma.moneyAccount.findFirst({ where: { kind: 'MERCADOPAGO' as never } });
    if (!account) throw new BadRequestException('Cuenta Mercado Pago no existe');
    const rows = await this.prisma.moneyMovement.findMany({
      where: { accountId: account.id, voidedAt: null },
      select: { kind: true, amount: true },
    });
    let delta = 0;
    for (const m of rows) delta += m.kind === 'INGRESO' ? Number(m.amount) : -Number(m.amount);
    const saldo = round2(Number(account.initialBalance) + delta);
    await this.prisma.setting.updateMany({ data: { mpBalanceCached: saldo, mpBalanceAt: new Date() } });
    return { disponible: saldo, at: new Date() };
  }

  // ─── Salidas de billetera vía Reporte de Liberaciones (release_report) ──
  // Nota: GET /v1/payments/search sólo expone ingresos. Los retiros de la
  // billetera (payout) se obtienen del Reporte de Liberaciones, único endpoint
  // financiero autorizado con el OAuth actual. Sólo registra SALIDAS; las
  // entradas siguen por el flujo existente (recordVenta / payments/search).
  private readonly releaseBaseUrl = 'https://api.mercadopago.com/v1/account/release_report';
  private readonly RELEASE_WINDOW_MS = 12 * 3600 * 1000; // reporte de las últimas 12 h
  private readonly RELEASE_POLL_MS = 5 * 60 * 1000;      // poll cada 5 min
  private readonly RELEASE_MAX_WAIT_MS = 90 * 60 * 1000; // tope 90 min

  private releaseHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async ensureReleaseConfig(token: string) {
    const body = {
      file_name_prefix: 'mposw-soler',
      frequency: { hour: 0, type: 'monthly', value: 1 },
      display_timezone: 'GMT-04',
      report_translation: 'es',
      scheduled: false,
      execute_after_withdrawal: false,
      include_withdrawal_at_end: true,
      compensate_detail: false,
      check_available_balance: false,
      columns: [
        { key: 'DATE' },
        { key: 'SOURCE_ID' },
        { key: 'EXTERNAL_REFERENCE' },
        { key: 'RECORD_TYPE' },
        { key: 'DESCRIPTION' },
        { key: 'NET_DEBIT_AMOUNT' },
        { key: 'NET_CREDIT_AMOUNT' },
      ],
    };
    const get = await fetch(`${this.releaseBaseUrl}/config`, { headers: { Authorization: `Bearer ${token}` } });
    const method = get.status === 404 ? 'POST' : 'PUT';
    const res = await fetch(`${this.releaseBaseUrl}/config`, {
      method,
      headers: this.releaseHeaders(token),
      body: JSON.stringify(body),
    });
    if (res.status >= 400) throw new Error(`release config ${method} ${res.status}: ${await res.text()}`);
    if (res.status === 404) {
      throw new Error('release config no se pudo crear');
    }
  }

  private async generateReleaseReport(token: string, beginISO: string, endISO: string): Promise<number> {
    // MP rechaza ISO con milisegundos (400 invalid_begin_date): normalizar a yyyy-MM-dd'T'HH:mm:ss'Z'
    const fmt = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const res = await fetch(this.releaseBaseUrl, {
      method: 'POST',
      headers: this.releaseHeaders(token),
      body: JSON.stringify({ begin_date: fmt(beginISO), end_date: fmt(endISO) }),
    });
    if (res.status !== 202) throw new Error(`release generate ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id?: number };
    return Number(data.id);
  }

  private async waitReleaseReport(token: string, beginISO: string): Promise<string | null> {
    const started = Date.now();
    const beginDay = beginISO.slice(0, 10);
    while (Date.now() - started < this.RELEASE_MAX_WAIT_MS) {
      const res = await fetch(`${this.releaseBaseUrl}/list`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`release list ${res.status}`);
      const list = (await res.json()) as Array<{
        begin_date?: string;
        date_created?: string;
        status?: string;
        file_name?: string;
      }>;
      const matches = (list || []).filter(
        (r) => r.status === 'enabled' && r.file_name && String(r.begin_date ?? '').slice(0, 10) === beginDay,
      );
      if (matches.length > 0) {
        matches.sort((a, b) => String(b.date_created ?? '').localeCompare(String(a.date_created ?? '')));
        return matches[0].file_name ?? null;
      }
      await new Promise((r) => setTimeout(r, this.RELEASE_POLL_MS));
    }
    this.logger.warn(`release report timeout esperando archivo para ${beginDay}`);
    return null;
  }

  private async downloadReleaseReport(token: string, fileName: string): Promise<string> {
    const res = await fetch(`${this.releaseBaseUrl}/${encodeURIComponent(fileName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`release download ${res.status}`);
    return await res.text();
  }

  // Convierte filas del CSV a objetos; soporta comillas simples y valores sin comas internas.
  private parseReleaseCsv(csv: string): Array<Record<string, string>> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const header = lines[0].split(',');
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h.trim()] = (cells[idx] ?? '').replace(/^"|"$/g, '').trim();
      });
      rows.push(row);
    }
    return rows;
  }

  // Sólo ingesta SALIDAS de la billetera (payout/withdrawal) → MpAccountMovement tipo RETIRO.
  // Ignora reserve_* (netean a 0) y las filas de crédito (entradas, ya cubiertas).
  private isOutflowRow(row: Record<string, string>): boolean {
    const desc = (row['DESCRIPTION'] ?? '').toLowerCase();
    if (desc !== 'payout' && desc !== 'withdrawal') return false;
    const debit = parseFloat(String(row['NET_DEBIT_AMOUNT'] ?? '0'));
    return debit > 0;
  }

  private async ingestOutflows(csv: string): Promise<number> {
    const rows = this.parseReleaseCsv(csv);
    let importados = 0;
    for (const row of rows) {
      if (!this.isOutflowRow(row)) continue;
      const sourceId = (row['SOURCE_ID'] ?? '').trim();
      if (!sourceId) continue;
      const debit = parseFloat(row['NET_DEBIT_AMOUNT']);
      const ext = (row['EXTERNAL_REFERENCE'] ?? '').trim() || null;
      const fecha = new Date(row['DATE'] ?? new Date().toISOString());
      const existing = await this.prisma.mpAccountMovement.findUnique({ where: { mpPaymentId: sourceId } });
      const raw = { record_type: row['RECORD_TYPE'] ?? null, description: row['DESCRIPTION'] ?? null } as never;
      await this.prisma.mpAccountMovement.upsert({
        where: { mpPaymentId: sourceId },
        create: {
          mpPaymentId: sourceId,
          tipo: 'RETIRO' as never,
          montoBruto: this.round2decimal(debit),
          fee: this.round2decimal(0),
          montoNeto: this.round2decimal(debit),
          pagador: null,
          email: null,
          externalRef: ext,
          merchantOrderId: null,
          fechaMp: fecha,
          raw,
          estado: 'PENDIENTE' as never,
        },
        update: {
          montoBruto: this.round2decimal(debit),
          montoNeto: this.round2decimal(debit),
          externalRef: ext,
          fechaMp: fecha,
          raw,
        },
      });
      importados += 1;
    }
    return importados;
  }

  private round2decimal(v: number) {
    return new Prisma.Decimal(Math.round(v * 100) / 100);
  }

  // ─── Sync de salidas: genera reporte 12 h + poll 5 min (tope 90) + descarga + upsert ──
  @Cron('0 */6 * * *')
  async cronReleaseSync() {
    try {
      const s = await this.prisma.setting.findUnique({ where: { id: DEFAULT_SETTING_ID } });
      const enabled = (s as { releaseReportEnabled?: boolean } | null)?.releaseReportEnabled ?? true;
      if (!enabled) return;
      await this.syncOutflows();
    } catch (e) {
      this.logger.warn(`release sync cron failed: ${e}`);
    }
  }

  async syncOutflows() {
    if (this.running) return { skipped: true };
    const token = await this.mpConfig.getAccessToken();
    if (!token) throw new BadRequestException('MP access token no configurado');
    const now = new Date();
    const fromISO = new Date(now.getTime() - this.RELEASE_WINDOW_MS).toISOString();
    const toISO = now.toISOString();
    this.running = true;
    try {
      await this.ensureReleaseConfig(token);
      const reportId = await this.generateReleaseReport(token, fromISO, toISO);
      this.logger.log(`release report solicitado id=${reportId} [${fromISO} -> ${toISO}]`);
      const fileName = await this.waitReleaseReport(token, fromISO);
      if (!fileName) {
        return { reportId, fileName: null, descargado: false, salidasImportadas: 0 };
      }
      const csv = await this.downloadReleaseReport(token, fileName);
      const salidasImportadas = await this.ingestOutflows(csv);
      const disponible = this.extractDisponible(csv);
      if (disponible != null) {
        await this.prisma.setting.updateMany({
          data: { mpDisponible: new Prisma.Decimal(disponible), mpDisponibleAt: now },
        });
      }
      await this.prisma.setting.updateMany({ data: { lastOutflowSyncAt: now } });
      this.logger.log(`release report ${fileName}: ${salidasImportadas} salida(s) importada(s)`);
      return { reportId, fileName, descargado: true, salidasImportadas, disponible };
    } finally {
      this.running = false;
    }
  }

  // Lee la fila RECORD_TYPE='total' (saldo disponible al cierre del período).
  private extractDisponible(csv: string): number | null {
    for (const row of this.parseReleaseCsv(csv)) {
      if ((row['RECORD_TYPE'] ?? '').trim() === 'total') {
        const v = parseFloat(String(row['NET_CREDIT_AMOUNT'] ?? '0'));
        if (!Number.isNaN(v)) return v;
      }
    }
    return null;
  }

  // ─── Listado + resumen ──
  async list(query: ListMpMovementsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const from = parseDayStart(query.from);
    const to = parseDayEnd(query.to);
    const where: Prisma.MpAccountMovementWhereInput = {
      ...(from || to ? { fechaMp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.estado ? { estado: query.estado as never } : {}),
      ...(query.tipo ? { tipo: query.tipo as never } : {}),
      ...(query.search ? { OR: [{ pagador: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }, { mpPaymentId: { contains: query.search } }, { externalRef: { contains: query.search } }] } : {}),
    };
    const [rows, total, agg] = await Promise.all([
      this.prisma.mpAccountMovement.findMany({
        where,
        include: { conciliaciones: { include: { moneyMovement: { include: { category: true, responsable: true } } } } },
        orderBy: { fechaMp: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.mpAccountMovement.count({ where }),
      this.prisma.mpAccountMovement.groupBy({
        by: ['estado'],
        where: { ...(from || to ? { fechaMp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
        _sum: { montoNeto: true },
        _count: { _all: true },
      }),
    ]);
    return {
      data: rows.map((m) => ({
        id: m.id,
        mpPaymentId: m.mpPaymentId,
        tipo: m.tipo,
        estado: m.estado,
        montoBruto: Number(m.montoBruto),
        fee: Number(m.fee),
        montoNeto: Number(m.montoNeto),
        pagador: m.pagador,
        email: m.email,
        externalRef: m.externalRef,
        fechaMp: m.fechaMp,
        nota: m.nota,
        conciliadoAt: m.conciliadoAt,
        vinculos: m.conciliaciones.map((c) => ({
          saleId: c.saleId,
          moneyMovementId: c.moneyMovementId,
          montoAsignado: Number(c.montoAsignado),
          gasto: c.moneyMovement ? { descripcion: c.moneyMovement.description, categoria: c.moneyMovement.category.name } : null,
        })),
      })),
      total, page, limit,
      resumen: agg.map((a) => ({ estado: a.estado, count: a._count._all, total: Number(a._sum.montoNeto ?? 0) })),
    };
  }

  async detail(id: string) {
    const m = await this.prisma.mpAccountMovement.findUnique({
      where: { id },
      include: { conciliaciones: { include: { moneyMovement: { include: { category: true, account: true, responsable: true } } } } },
    });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    // Candidatos: ventas MP mismo monto ±3 días sin conciliar + gastos MP mismo monto
    const candidatos = await this.prisma.sale.findMany({
      where: {
        paymentMethod: { in: ['MP_QR', 'TRANSFER'] as never },
        total: { gte: new Prisma.Decimal(Number(m.montoNeto) - 0.05), lte: new Prisma.Decimal(Number(m.montoNeto) + 0.05) },
        paidAt: { gte: new Date(m.fechaMp.getTime() - 3 * 864e5), lte: new Date(m.fechaMp.getTime() + 3 * 864e5) },
      },
      take: 10,
      select: { id: true, orderNumber: true, total: true, paymentMethod: true, paidAt: true },
    });
    const used = await this.prisma.mpConciliacion.findMany({ where: { saleId: { in: candidatos.map((c) => c.id) } }, select: { saleId: true } });
    const usedIds = new Set(used.map((u) => u.saleId));
    return {
      ...m,
      montoBruto: Number(m.montoBruto),
      fee: Number(m.fee),
      montoNeto: Number(m.montoNeto),
      candidatos: candidatos.filter((c) => !usedIds.has(c.id)),
    };
  }

  // ─── Acciones FULL ──
  async vincular(id: string, dto: { saleId?: string; moneyMovementId?: string }, userId?: string) {
    const m = await this.prisma.mpAccountMovement.findUnique({ where: { id }, include: { conciliaciones: true } });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    if (!dto.saleId && !dto.moneyMovementId) throw new BadRequestException('saleId o moneyMovementId requerido');
    if (dto.moneyMovementId) {
      const mm = await this.prisma.moneyMovement.findUnique({ where: { id: dto.moneyMovementId } });
      if (!mm) throw new NotFoundException('Gasto no encontrado');
    }
    await this.prisma.mpConciliacion.create({
      data: { mpMovementId: id, saleId: dto.saleId ?? null, moneyMovementId: dto.moneyMovementId ?? null, montoAsignado: m.montoNeto as never },
    });
    return this.prisma.mpAccountMovement.update({
      where: { id },
      data: { estado: 'CONCILIADO', conciliadoAt: new Date(), conciliadoPorId: userId ?? null },
    });
  }

  async categorizar(id: string, dto: { categoryId: string; concepto?: string; observaciones?: string; responsableId?: string; nota?: string }, userId?: string) {
    const m = await this.prisma.mpAccountMovement.findUnique({ where: { id }, include: { conciliaciones: true } });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    if (m.conciliaciones.length > 0) throw new BadRequestException('Ya está conciliado');
    await this.finanzas.ensureDefaults();
    const category = await this.prisma.moneyCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category?.active) throw new BadRequestException('Categoría no válida');
    const mpAccount = await this.prisma.moneyAccount.findFirst({ where: { kind: 'MERCADOPAGO' as never } });
    if (!mpAccount) throw new BadRequestException('Cuenta Mercado Pago no existe');
    const isEgreso = ['RETIRO', 'GASTO', 'FEE'].includes(m.tipo as string);
    const mm = await this.prisma.moneyMovement.create({
      data: {
        date: m.fechaMp,
        kind: isEgreso ? 'EGRESO' : 'INGRESO',
        amount: m.montoNeto as never,
        accountId: mpAccount.id,
        categoryId: category.id,
        concepto: (dto.concepto ?? m.pagador ?? `MP ${m.mpPaymentId}`).slice(0, 120),
        description: dto.concepto ?? m.pagador ?? `MP ${m.mpPaymentId}`,
        observaciones: dto.observaciones ?? null,
        responsableId: dto.responsableId ?? null,
        source: 'MP_SYNC' as never,
        sourceId: m.mpPaymentId,
        userId: userId ?? null,
      },
    });
    await this.prisma.mpConciliacion.create({ data: { mpMovementId: id, moneyMovementId: mm.id, montoAsignado: m.montoNeto as never } });
    return this.prisma.mpAccountMovement.update({
      where: { id },
      data: { estado: 'CONCILIADO', conciliadoAt: new Date(), conciliadoPorId: userId ?? null, nota: dto.nota ?? null },
    });
  }

  async ignorar(id: string) {
    const m = await this.prisma.mpAccountMovement.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    return this.prisma.mpAccountMovement.update({ where: { id }, data: { estado: 'IGNORADO' } });
  }

  async desvincular(id: string) {
    const m = await this.prisma.mpAccountMovement.findUnique({ where: { id }, include: { conciliaciones: true } });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    // Borra gastos MP_SYNC auto-creados (no los manuales vinculados)
    for (const c of m.conciliaciones) {
      if (c.moneyMovementId) {
        const mm = await this.prisma.moneyMovement.findUnique({ where: { id: c.moneyMovementId } });
        if (mm?.source === 'MP_SYNC') await this.prisma.moneyMovement.delete({ where: { id: mm.id } });
      }
    }
    await this.prisma.mpConciliacion.deleteMany({ where: { mpMovementId: id } });
    return this.prisma.mpAccountMovement.update({ where: { id }, data: { estado: 'PENDIENTE', conciliadoAt: null, conciliadoPorId: null } });
  }
}

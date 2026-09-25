import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';

// ─── Regla simple y auditable ─────────────────────────────────────
// Tasa mensual configurada (global o por acreedor). Cada lunes se aplica
// UNA semana: tasaSemanal = tasaMensual * 7 / 30 (prorrateo lineal).
// Base = capital vencido > 30 días (fiados + ajustes MANUALES, FIFO: los
// pagos alivian lo más antiguo primero). Amnistía única: la fecha efectiva
// de cada capital es max(fechaOriginal, fechaAmnistia) — la deuda anterior
// a la amnistía queda en 0 días y recién genera a los 30 días del aviso.
// Los intereses previos NO generan interés (sin anatocismo). Saldo a favor
// no genera nada. Cada aplicación queda como un AjusteAcreedor con
// esInteres=true + periodo "YYYY-Www": idempotente y trazable.

export const DIAS_GRACIA_VENCIMIENTO = 30;
export const DIAS_MES_PRORRATEO = 30;
export const DIAS_SEMANA = 7;

export function tasaSemanalDesdeMensual(tasaMensualPct: number): number {
  return (tasaMensualPct * DIAS_SEMANA) / DIAS_MES_PRORRATEO;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Lunes 12:00 UTC de la semana que contiene `ref` (12:00 = mediodía, convención del módulo). */
export function lunesDeSemana(ref: Date): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 12, 0, 0));
  const dow = d.getUTCDay(); // 0=domingo
  const diff = (dow + 6) % 7; // días desde el lunes
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Etiqueta ISO "YYYY-Www" para el periodo del corte. */
export function periodoSemanal(corte: Date): string {
  const d = new Date(Date.UTC(corte.getUTCFullYear(), corte.getUTCMonth(), corte.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // lunes=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jueves de la semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface CapitalEntry {
  fecha: Date;
  monto: number;
}

/** Base vencida: capital con >30 días al corte menos pagos hasta el corte (FIFO: pagos a lo más viejo primero).
 * Amnistía única: fechaEfectiva = max(fechaOriginal, fechaAmnistia). */
export function calcularBaseVencida(
  fiados: CapitalEntry[],
  ajustesCapital: CapitalEntry[],
  pagos: CapitalEntry[],
  corte: Date,
  fechaAmnistia?: Date | null,
): { base: number; totalVencido: number; totalPagos: number } {
  const limite = new Date(corte.getTime() - DIAS_GRACIA_VENCIMIENTO * 24 * 3600 * 1000);
  const amnistiaTs = fechaAmnistia ? new Date(fechaAmnistia).getTime() : null;
  const esVencido = (fecha: Date): boolean => {
    const ts = new Date(fecha).getTime();
    const efectiva = amnistiaTs != null ? Math.max(ts, amnistiaTs) : ts;
    return efectiva <= limite.getTime();
  };
  const totalVencido = round2(
    [...fiados, ...ajustesCapital]
      .filter((e) => esVencido(new Date(e.fecha)))
      .reduce((s, e) => s + Number(e.monto), 0),
  );
  const totalPagos = round2(
    pagos
      .filter((p) => new Date(p.fecha).getTime() <= corte.getTime())
      .reduce((s, p) => s + Number(p.monto), 0),
  );
  return { base: round2(Math.max(0, totalVencido - totalPagos)), totalVencido, totalPagos };
}

export function calcularInteresSemanal(base: number, tasaMensualPct: number): number {
  if (base <= 0 || tasaMensualPct <= 0) return 0;
  return round2((base * tasaMensualPct * DIAS_SEMANA) / 100 / DIAS_MES_PRORRATEO);
}

export interface PreviewFila {
  acreedorId: number;
  nombre: string;
  tasaMensual: number;
  tasaSemanal: number;
  baseVencida: number;
  interesAcumulado: number;
  deudaActual: number;
  interes: number;
  periodo: string;
  yaAplicado: boolean;
  motivoOmision: string | null;
}

@Injectable()
export class AcreedoresInteresesService {
  private readonly logger = new Logger(AcreedoresInteresesService.name);
  constructor(private prisma: PrismaService) {}

  private async getConfig() {
    const setting = await this.prisma.setting.findFirst({ orderBy: { createdAt: 'desc' } });
    return {
      habilitado: setting?.interesAcreedoresHabilitado === true,
      tasaGlobal: setting?.tasaInteresMensualAcreedores != null ? Number(setting.tasaInteresMensualAcreedores) : null,
      fechaAmnistia: setting?.interesFechaAmnistia != null ? new Date(setting.interesFechaAmnistia as unknown as string) : null,
    };
  }

  /** Simula el lunes (sin grabar): ideal para auditar antes del débito real. */
  async preview(fechaRef?: Date): Promise<{ corte: Date; periodo: string; filas: PreviewFila[] }> {
    const corte = lunesDeSemana(fechaRef ?? new Date());
    const periodo = periodoSemanal(corte);
    const { habilitado, tasaGlobal, fechaAmnistia } = await this.getConfig();

    const acreedores = await this.prisma.acreedor.findMany({
      where: { activo: true },
      include: { fiadoVentas: true, pagos: true, ajustes: true },
      orderBy: { nombre: 'asc' },
    });

    const filas: PreviewFila[] = [];
    for (const a of acreedores) {
      const tasaMensual =
        a.tasaInteresMensual != null ? Number(a.tasaInteresMensual) : (tasaGlobal ?? 0);
      const ajustesInteres = a.ajustes.filter((x) => (x as unknown as { esInteres?: boolean }).esInteres);
      const ajustesCapital = a.ajustes.filter((x) => !(x as unknown as { esInteres?: boolean }).esInteres);
      const pagosList = a.pagos.map((p) => ({ fecha: new Date(p.fecha), monto: Number(p.monto) }));
      const { base, totalVencido, totalPagos } = calcularBaseVencida(
        a.fiadoVentas.map((v) => ({ fecha: new Date(v.createdAt), monto: Number(v.monto) })),
        ajustesCapital.map((x) => ({ fecha: new Date(x.fecha), monto: Number(x.monto) })),
        pagosList,
        corte,
        fechaAmnistia,
      );
      const interesAcumulado = round2(
        ajustesInteres.reduce((s, x) => s + Number((x as unknown as { monto: unknown }).monto), 0),
      );
      const totalCapital = round2(
        a.fiadoVentas.reduce((s, v) => s + Number(v.monto), 0) +
          ajustesCapital.reduce((s, x) => s + Number((x as unknown as { monto: unknown }).monto), 0),
      );
      const saldoTotal = round2(totalCapital + interesAcumulado - totalPagos);
      const deudaActual = round2(Math.max(0, saldoTotal));
      const yaAplicado = ajustesInteres.some(
        (x) => (x as unknown as { periodo?: string | null }).periodo === periodo,
      );
      const interes = calcularInteresSemanal(base, tasaMensual);
      let motivoOmision: string | null = null;
      if (!habilitado) motivoOmision = 'Intereses no habilitados en Configuración';
      else if (!fechaAmnistia) motivoOmision = 'Falta fecha de amnistía en Configuración';
      else if (saldoTotal <= 0) motivoOmision = 'Saldo a favor, no genera interés';
      else if (tasaMensual <= 0) motivoOmision = 'Sin tasa (ni propia ni global)';
      else if (totalVencido <= 0) motivoOmision = 'Sin deuda vencida >30 días';
      else if (base <= 0) motivoOmision = 'Pagos cubren lo vencido';
      else if (yaAplicado) motivoOmision = `Periodo ${periodo} ya aplicado`;
      else if (interes < 0.01) motivoOmision = 'Interés menor a $0,01';
      filas.push({
        acreedorId: a.id,
        nombre: a.nombre,
        tasaMensual: round2(tasaMensual),
        tasaSemanal: round2(tasaSemanalDesdeMensual(tasaMensual)),
        baseVencida: base,
        interesAcumulado,
        deudaActual,
        interes: motivoOmision ? 0 : interes,
        periodo,
        yaAplicado,
        motivoOmision,
      });
    }
    return { corte, periodo, filas };
  }

  /** Aplica el lunes (idempotente por periodo). El interés NO respeta el límite: es deuda generada, no nueva venta. */
  async aplicar(fechaRef?: Date): Promise<{ periodo: string; aplicados: number; omitidos: number; detalles: PreviewFila[] }> {
    const { corte, periodo, filas } = await this.preview(fechaRef);
    let aplicados = 0;
    for (const f of filas) {
      if (f.motivoOmision || f.interes <= 0) continue;
      const deudaNueva = round2(f.deudaActual + f.interes);
      try {
        await this.prisma.ajusteAcreedor.create({
          data: {
            acreedorId: f.acreedorId,
            monto: f.interes,
            fecha: corte,
            descripcion: `Interés semanal ${periodo} — ${f.tasaMensual}% mensual (→ ${f.tasaSemanal}% semanal) s/ base $${f.baseVencida.toFixed(2)} + int.acum. $${f.interesAcumulado.toFixed(2)} = deuda $${f.deudaActual.toFixed(2)} + nuevo $${f.interes.toFixed(2)} = $${deudaNueva.toFixed(2)}`,
            esInteres: true,
            periodo,
            tasaMensualAplicada: f.tasaMensual,
            baseCalculo: f.baseVencida,
          } as never,
        });
        aplicados++;
      } catch (err) {
        // Carrera entre dos ejecuciones: el índice/chequeo de periodo evita duplicar.
        this.logger.warn(`Interés acreedor #${f.acreedorId} periodo ${periodo}: ${(err as Error).message}`);
        f.motivoOmision = 'Error al registrar (posible duplicado)';
        f.interes = 0;
      }
    }
    const omitidos = filas.length - aplicados;
    return { periodo, aplicados, omitidos, detalles: filas };
  }

  // Lunes 09:00 UTC = 06:00 ART (GMT-3). Corte = lunes 12:00 UTC (incluye todo el finde).
  // Se corre temprano para que las notificaciones del lunes ya incluyan el interés.
  @Cron('0 0 9 * * 1')
  async handleInteresSemanal() {
    try {
      const { habilitado } = await this.getConfig();
      if (!habilitado) return;
      const r = await this.aplicar(new Date());
      this.logger.log(`Interés semanal ${r.periodo}: ${r.aplicados} aplicados, ${r.omitidos} omitidos.`);
    } catch (err) {
      this.logger.error(`Cron interés semanal: ${(err as Error).message}`);
    }
  }
}

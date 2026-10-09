// DESIGN.md §6 — únicos formateadores (locale es-AR).
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfNum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function formatMoney(value: number | string | null | undefined, opts?: { cents?: boolean }): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '$ 0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const body = opts?.cents ? nf2.format(abs) : nf0.format(abs);
  return `${sign}$ ${body}`;
}

export function formatPercent(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0,0%';
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return nfNum.format(n);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateLong(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { downloadEntradasJornadaPdf, useEntradasJornadaResumen } from '../api/queries';
import type { JornadaMetodo, JornadaResumen } from '../api/types';
import { useToast } from './ToastProvider';
import { formatMoney, formatPercent } from '../utils/format';

const COLORS = ['var(--color-primary)', '#16a34a', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];
const CHART_COLORS = ['#0e7490', '#16a34a', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

const card: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1rem 1.25rem',
};

const h3: React.CSSProperties = { margin: '0 0 0.75rem', fontSize: '1rem' };
const muted: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };

const SegmentedBar: React.FC<{ segs: Array<{ pct: number; color: string }>; label: string }> = ({ segs, label }) => (
  <div
    role="img"
    aria-label={label}
    style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: 'var(--color-surface-alt)' }}
  >
    {segs.map((s, i) => (
      <div key={i} title={`${s.pct}%`} style={{ width: `${s.pct}%`, background: s.color, minWidth: s.pct > 0 ? 2 : 0 }} />
    ))}
  </div>
);

const MetodoLegend: React.FC<{ metodos: JornadaMetodo[]; offset?: number }> = ({ metodos, offset = 0 }) => (
  <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    {metodos.map((m, i) => (
      <li key={m.metodo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[(i + offset) % COLORS.length] }} />
        <strong>{m.metodo}</strong>
        <span style={muted}>
          {m.cant} · {formatMoney(m.monto)} ({formatPercent(m.pct / 100)})
        </span>
      </li>
    ))}
  </ul>
);

export const ResumenJornada: React.FC<{ fixtureId?: string; eventoId?: string }> = ({ fixtureId, eventoId }) => {
  const { data, isLoading, isError } = useEntradasJornadaResumen(fixtureId, eventoId);
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div style={{ ...card, marginBottom: '1rem' }}>
        <span style={muted}>Armando el resumen de jornada…</span>
      </div>
    );
  }
  if (isError || !data) return null;
  const r: JornadaResumen = data;

  const onDownload = async () => {
    setBusy(true);
    try {
      await downloadEntradasJornadaPdf(fixtureId, eventoId);
      pushToast('PDF descargado', 'success');
    } catch {
      pushToast('No se pudo descargar el PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sectorTotal = r.entradas.totalCant || 1;
  const horas = r.horasPico.filter((h) => h.entradas > 0 || h.bufet > 0);
  const peak = horas.length > 0 ? horas.reduce((a, b) => (b.entradas + b.bufet >= a.entradas + a.bufet ? b : a)) : null;

  return (
    <div style={{ ...card, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ ...h3, margin: 0 }}>Resumen de jornada</h3>
          <div style={muted}>{r.jornada.titulo}</div>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={onDownload} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Download size={15} /> {busy ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Entradas', value: `${r.entradas.totalCant}`, sub: formatMoney(r.entradas.totalMonto) },
          { label: 'Bufet', value: `${r.bufet.totalCant} tickets`, sub: formatMoney(r.bufet.totalMonto) },
          { label: 'Ticket prom. bufet', value: formatMoney(r.bufet.ticketPromedio), sub: `${r.bufet.topProductos.length} en top` },
          { label: 'Total general', value: formatMoney(r.totalGeneral), sub: 'Entradas + bufet', hot: true },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              borderRadius: 10,
              padding: '0.7rem 1rem',
              background: k.hot ? 'var(--color-primary)' : 'var(--color-surface-alt)',
              color: k.hot ? 'var(--color-on-primary, #fff)' : undefined,
            }}
          >
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{k.label.toUpperCase()}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{k.value}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {/* Entradas por sector */}
        <section>
          <h3 style={h3}>Entradas por sector</h3>
          {r.entradas.porSector.length === 0 ? (
            <p style={muted}>Sin entradas aprobadas.</p>
          ) : (
            <>
              <SegmentedBar
                label={`Entradas por sector: ${r.entradas.porSector.map((s) => `${s.sector} ${s.cant}`).join(', ')}`}
                segs={r.entradas.porSector.map((s, i) => ({ pct: (s.cant / sectorTotal) * 100, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              />
              <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {r.entradas.porSector.map((s, i) => (
                  <li key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length] }} />
                    <strong>{s.sector}</strong>
                    <span style={muted}>
                      {s.cant} ({formatPercent(s.pct / 100)}) · {formatMoney(s.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Entradas por medio */}
        <section>
          <h3 style={h3}>Entradas por medio de pago · {formatMoney(r.entradas.totalMonto)}</h3>
          {r.entradas.porMetodo.length === 0 ? (
            <p style={muted}>Sin ventas.</p>
          ) : (
            <>
              <SegmentedBar
                label="Entradas por medio de pago"
                segs={r.entradas.porMetodo.map((m, i) => ({ pct: m.pct, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              />
              <MetodoLegend metodos={r.entradas.porMetodo} />
            </>
          )}
        </section>

        {/* Bufet por medio */}
        <section>
          <h3 style={h3}>Bufet por medio de pago · {formatMoney(r.bufet.totalMonto)}</h3>
          {r.bufet.porMetodo.length === 0 ? (
            <p style={muted}>Sin ventas de bufet en la ventana de esta jornada.</p>
          ) : (
            <>
              <SegmentedBar
                label="Bufet por medio de pago"
                segs={r.bufet.porMetodo.map((m, i) => ({ pct: m.pct, color: CHART_COLORS[(i + 1) % CHART_COLORS.length] }))}
              />
              <MetodoLegend metodos={r.bufet.porMetodo} offset={1} />
            </>
          )}
        </section>

        {/* Top productos */}
        <section>
          <h3 style={h3}>Productos más vendidos (bufet)</h3>
          {r.bufet.topProductos.length === 0 ? (
            <p style={muted}>Sin productos vendidos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, r.bufet.topProductos.slice(0, 8).length * 36)}>
              <BarChart data={[...r.bufet.topProductos.slice(0, 8)].reverse()} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown, name: unknown) => [name === 'monto' ? formatMoney(Number(v ?? 0)) : String(v ?? ''), name === 'monto' ? 'Monto' : 'Cant.']} />
                <Bar dataKey="monto" name="monto" radius={[0, 4, 4, 0]}>
                  {[...r.bufet.topProductos.slice(0, 8)].reverse().map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Horas pico */}
      <section style={{ marginTop: '1.25rem' }}>
        <h3 style={h3}>
          Horas pico de ventas{peak ? <span style={{ ...muted, marginLeft: '0.5rem' }}>Pico {peak.hora} — {peak.entradas + peak.bufet} ventas</span> : null}
        </h3>
        {horas.length === 0 ? (
          <p style={muted}>Sin ventas registradas por hora.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={horas} margin={{ top: 8, right: 16, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(horas.length / 12) - 1)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#0e7490" radius={[3, 3, 0, 0]} />
              <Bar dataKey="bufet" name="Bufet" fill="#16a34a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Pie */}
      <div
        style={{
          marginTop: '1.25rem',
          borderRadius: 10,
          padding: '0.8rem 1.1rem',
          background: 'var(--color-surface-alt)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Beneficios: {r.beneficios.otorgados} otorgados · {r.beneficios.canjeados} canjeados
          {r.noAprobadas.length > 0 && <> · No suman: {r.noAprobadas.map((x) => `${x.status} ${x.cant}`).join(' · ')}</>}
        </span>
        <strong style={{ fontSize: '1.1rem' }}>Total general: {formatMoney(r.totalGeneral)}</strong>
      </div>
    </div>
  );
};

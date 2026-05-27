import { useMemo, useState } from 'react';
import { useAdminSales, useSettings } from '../api/queries';
import type { TicketPayload } from '../utils/ticketPrinting';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const normalizeAmount = (value?: number | string | null) => {
  if (typeof value === 'number') return value;
  const p = Number(value);
  return Number.isFinite(p) ? p : 0;
};

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

const paymentLabels: Record<string, string> = { CASH: 'Efectivo', MP_QR: 'QR', TRANSFER: 'Transf.' };

export const AdminStatsPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const { data: settings } = useSettings();
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');

  const filteredSales = useMemo(() => {
    if (!startDate && !endDate) return sales;
    const start = startDate ? new Date(`${startDate}T${startTime || '00:00'}`) : null;
    const end = endDate ? new Date(`${endDate}T${endTime || '23:59'}`) : null;
    return sales.filter((s) => {
      const d = new Date(s.createdAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [sales, startDate, startTime, endDate, endTime]);

  const productTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((s) => { s.items.forEach((i) => { totals.set(i.product.name, (totals.get(i.product.name) || 0) + i.quantity); }); });
    return Array.from(totals.entries()).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity);
  }, [filteredSales]);

  const paymentTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((s) => { const m = s.paymentMethod ?? 'CASH'; totals.set(m, (totals.get(m) || 0) + normalizeAmount(s.total)); });
    return Array.from(totals.entries()).map(([method, total]) => ({ method, total }));
  }, [filteredSales]);

  const paymentSummary = useMemo(() => {
    const totalAmount = paymentTotals.reduce((acc, i) => acc + i.total, 0);
    const palette = ['#38bdf8', '#f97316', '#a78bfa', '#4ade80'];
    let current = 0;
    const segments = paymentTotals.map((item, idx) => {
      const percent = totalAmount ? (item.total / totalAmount) * 100 : 0;
      const start = current;
      current += percent;
      return { ...item, percent, color: palette[idx % palette.length], gradient: `${palette[idx % palette.length]} ${start}% ${current}%` };
    });
    return { totalAmount, segments, gradient: segments.length ? `conic-gradient(${segments.map((s) => s.gradient).join(', ')})` : 'conic-gradient(#e2e8f0 0% 100%)' };
  }, [paymentTotals]);

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    sales.forEach((s) => { const dk = s.createdAt.slice(0, 10); totals.set(dk, (totals.get(dk) || 0) + normalizeAmount(s.total)); });
    return Array.from(totals.entries()).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  }, [sales]);

  const maxProduct = productTotals[0]?.quantity ?? 0;
  const maxDailyTotal = dailyTotals.reduce((acc, i) => Math.max(acc, i.total), 0);
  const totalSales = paymentSummary.totalAmount;
  const totalProducts = productTotals.reduce((acc, i) => acc + i.quantity, 0);
  const avgTicket = filteredSales.length ? totalSales / filteredSales.length : 0;
  const topProduct = productTotals[0]?.name ?? '—';

  const handlePrintStats = () => {
    if (filteredSales.length === 0) return;
    const sorted = [...filteredSales].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const first = sorted[0], last = sorted[sorted.length - 1];
    const fmt = (d: string) => { const dt = new Date(d); return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    const paymentLines: { label: string; value: string }[] = [];
    paymentSummary.segments.forEach((s) => { paymentLines.push({ label: paymentLabels[s.method] ?? s.method, value: `${s.percent.toFixed(1)}%` }); paymentLines.push({ label: '', value: formatCurrency(s.total) }); });
    const productLines = productTotals.slice(0, 10).map((p) => ({ label: p.name.substring(0, 18), value: `${p.quantity} (${((p.quantity / totalProducts) * 100).toFixed(1)}%)` }));
    const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? '', dateTimeISO: new Date().toISOString(), itemsStyle: 'summary', items: [], criteria: [{ label: 'Desde:', value: fmt(first.createdAt) }, { label: 'Hasta:', value: fmt(last.createdAt) }, { label: 'Total ventas:', value: formatCurrency(totalSales) }, { label: 'Total productos:', value: totalProducts.toString() }], summary: [{ label: 'MEDIOS DE PAGO', value: '' }, ...paymentLines, { label: '', value: '' }, { label: 'PRODUCTOS', value: '' }, ...productLines], title: 'ESTADISTICAS', footer: 'Resumen de ventas' };
    window.location.href = `/printticket?data=${encodeURIComponent(encodeBase64(JSON.stringify(payload)))}`;
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Estadisticas</h2>
            <p className="page-header-subtitle">Analiza ventas, productos y medios de pago por periodo.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={handlePrintStats} disabled={filteredSales.length === 0}>Imprimir reporte</button>
        </div>
      </div>

      <div className="stats-kpi-main">
        <span className="stats-kpi-main-label">Ventas totales</span>
        <span className="stats-kpi-main-value">{formatCurrency(totalSales)}</span>
      </div>

      <div className="stats-kpis">
        <div className="stats-kpi-card">
          <span className="stats-kpi-label">Operaciones</span>
          <span className="stats-kpi-value">{filteredSales.length}</span>
        </div>
        <div className="stats-kpi-card">
          <span className="stats-kpi-label">Ticket promedio</span>
          <span className="stats-kpi-value">{formatCurrency(avgTicket)}</span>
        </div>
        <div className="stats-kpi-card">
          <span className="stats-kpi-label">Productos vendidos</span>
          <span className="stats-kpi-value">{totalProducts}</span>
        </div>
        <div className="stats-kpi-card">
          <span className="stats-kpi-label">Mas vendido</span>
          <span className="stats-kpi-value">{topProduct}</span>
        </div>
      </div>

      <div className="stock-toolbar">
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
        <label className="input-field input-field--compact" style={{ margin: 0 }}>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
        </label>
      </div>

      <div className="admin-stats__grid">
        <div className="settings-section">
          <h3 className="settings-section-header">Productos vendidos</h3>
          {productTotals.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Sin ventas en el rango.</p>
          ) : (
            <div className="stats-bar-chart">
              {productTotals.map((product) => (
                <div className="stats-bar" key={product.name}>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill" style={{ width: `${(product.quantity / maxProduct) * 100}%` }} />
                  </div>
                  <div className="stats-bar-meta">
                    <span className="stats-bar-name">{product.name}</span>
                    <span className="stats-bar-qty">{product.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3 className="settings-section-header">Medios de pago</h3>
          {paymentSummary.totalAmount === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Sin ventas en el rango.</p>
          ) : (
            <div className="stats-donut">
              <div className="stats-donut-chart" style={{ background: paymentSummary.gradient }} />
              <div className="stats-donut-legend">
                {paymentSummary.segments.map((s) => (
                  <div key={s.method} className="stats-donut-legend-item">
                    <span className="stats-donut-dot" style={{ background: s.color }} />
                    <span className="stats-donut-label">{paymentLabels[s.method] ?? s.method}</span>
                    <span className="stats-donut-value">{formatCurrency(s.total)}</span>
                    <span className="stats-donut-pct">{s.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {dailyTotals.length > 0 && (
        <div className="settings-section" style={{ marginTop: '1rem' }}>
          <h3 className="settings-section-header">Ventas recientes</h3>
          <p className="settings-section-desc">Comparativa de los ultimos dias con venta registrada.</p>
          <div className="stats-daily">
            {dailyTotals.map((day) => (
              <div className="stats-daily-bar" key={day.date}>
                <div className="stats-daily-fill">
                  <span style={{ height: `${maxDailyTotal ? (day.total / maxDailyTotal) * 100 : 0}%` }} />
                </div>
                <div className="stats-daily-meta">
                  <span className="stats-daily-date">{formatDateLabel(day.date)}</span>
                  <span className="stats-daily-amount">{formatCurrency(day.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

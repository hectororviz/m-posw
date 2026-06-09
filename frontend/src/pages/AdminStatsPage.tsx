import { useMemo, useState } from 'react';
import { useSettings, useStatsSummary } from '../api/queries';
import type { TicketPayload } from '../utils/ticketPrinting';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDateLabel = (value: string) =>
  new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const today = () => new Date().toISOString().slice(0, 10);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
};

const paymentLabels: Record<string, string> = { CASH: 'Efectivo', MP_QR: 'QR', TRANSFER: 'Transf.' };

export const AdminStatsPage: React.FC = () => {
  const [startDate, setStartDate] = useState(daysAgo(7));
  const [endDate, setEndDate] = useState(today());
  const { data: settings } = useSettings();
  const { data: stats, isLoading } = useStatsSummary(startDate, endDate);

  const totals = useMemo(() => {
    if (!stats) return {
      totalSales: 0, salesCount: 0, avgTicket: 0,
      totalProducts: 0, topProduct: '—',
      byProduct: [], byPaymentMethod: [], byDay: [],
    };
    return stats;
  }, [stats]);

  const paymentSummary = useMemo(() => {
    const totalAmount = totals.byPaymentMethod.reduce((acc, i) => acc + i.total, 0);
    const style = getComputedStyle(document.documentElement);
    const palette = [style.getPropertyValue('--chart-1').trim(), style.getPropertyValue('--chart-2').trim(), style.getPropertyValue('--chart-3').trim(), style.getPropertyValue('--chart-4').trim()];
    const segments = totals.byPaymentMethod.map((item, idx) => {
      const percent = totalAmount ? (item.total / totalAmount) * 100 : 0;
      const color = palette[idx % palette.length] || '#e2e8f0';
      const start = totals.byPaymentMethod.slice(0, idx).reduce((acc, i) => acc + (totalAmount ? (i.total / totalAmount) * 100 : 0), 0);
      return { ...item, percent, color, gradient: `${color} ${start}% ${start + percent}%` };
    });
    return { totalAmount, segments, gradient: segments.length ? `conic-gradient(${segments.map((s) => s.gradient).join(', ')})` : 'conic-gradient(var(--color-border) 0% 100%)' };
  }, [totals]);

  const maxProduct = totals.byProduct[0]?.quantity ?? 0;
  const maxDailyTotal = totals.byDay.reduce((acc, i) => Math.max(acc, i.total), 0);

  const handlePrintStats = () => {
    if (totals.salesCount === 0) return;
    const fmt = (d: string) => { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); };
    const paymentLines: { label: string; value: string }[] = [];
    paymentSummary.segments.forEach((s) => { paymentLines.push({ label: paymentLabels[s.method] ?? s.method, value: `${s.percent.toFixed(1)}%` }); paymentLines.push({ label: '', value: formatCurrency(s.total) }); });
    const productLines = totals.byProduct.slice(0, 10).map((p) => ({ label: p.name.substring(0, 18), value: `${p.quantity} (${totals.totalProducts ? ((p.quantity / totals.totalProducts) * 100).toFixed(1) : 0}%)` }));
    const payload: TicketPayload = { clubName: settings?.clubName ?? '', storeName: settings?.storeName ?? '', dateTimeISO: new Date().toISOString(), itemsStyle: 'summary', items: [], criteria: [{ label: 'Desde:', value: fmt(startDate) }, { label: 'Hasta:', value: fmt(endDate) }, { label: 'Total ventas:', value: formatCurrency(totals.totalSales) }, { label: 'Total productos:', value: totals.totalProducts.toString() }], summary: [{ label: 'MEDIOS DE PAGO', value: '' }, ...paymentLines, { label: '', value: '' }, { label: 'PRODUCTOS', value: '' }, ...productLines], title: 'ESTADISTICAS', footer: 'Resumen de ventas' };
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
          <button type="button" className="btn-ghost" onClick={handlePrintStats} disabled={totals.salesCount === 0}>Imprimir reporte</button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-text-faint)', padding: '2rem', textAlign: 'center' }}>Cargando...</p>
      ) : (
        <>
          <div className="stats-kpi-main">
            <span className="stats-kpi-main-label">Ventas totales</span>
            <span className="stats-kpi-main-value">{formatCurrency(totals.totalSales)}</span>
          </div>

          <div className="stats-kpis">
            <div className="stats-kpi-card">
              <span className="stats-kpi-label">Operaciones</span>
              <span className="stats-kpi-value">{totals.salesCount}</span>
            </div>
            <div className="stats-kpi-card">
              <span className="stats-kpi-label">Ticket promedio</span>
              <span className="stats-kpi-value">{formatCurrency(totals.avgTicket)}</span>
            </div>
            <div className="stats-kpi-card">
              <span className="stats-kpi-label">Productos vendidos</span>
              <span className="stats-kpi-value">{totals.totalProducts}</span>
            </div>
            <div className="stats-kpi-card">
              <span className="stats-kpi-label">Mas vendido</span>
              <span className="stats-kpi-value">{totals.topProduct}</span>
            </div>
          </div>

          <div className="stock-toolbar">
            <label className="input-field input-field--compact" style={{ margin: 0 }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
            </label>
            <span style={{ color: 'var(--color-text-faint)', alignSelf: 'center' }}>—</span>
            <label className="input-field input-field--compact" style={{ margin: 0 }}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.5rem 0.65rem', fontSize: '0.85rem' }} />
            </label>
          </div>

          {totals.salesCount === 0 ? (
            <p style={{ color: 'var(--color-text-faint)', fontSize: '0.9rem', padding: '1rem 0' }}>Sin ventas en el periodo seleccionado.</p>
          ) : (
            <>
              <div className="admin-stats__grid">
                <div className="settings-section">
                  <h3 className="settings-section-header">Productos vendidos</h3>
                  <div className="stats-bar-chart">
                    {totals.byProduct.map((product) => (
                      <div className="stats-bar" key={product.name}>
                        <div className="stats-bar-track">
                          <div className="stats-bar-fill" style={{ width: `${maxProduct ? (product.quantity / maxProduct) * 100 : 0}%` }} />
                        </div>
                        <div className="stats-bar-meta">
                          <span className="stats-bar-name">{product.name}</span>
                          <span className="stats-bar-qty">{product.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="settings-section">
                  <h3 className="settings-section-header">Medios de pago</h3>
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
                </div>
              </div>

              {totals.byDay.length > 0 && (
                <div className="settings-section" style={{ marginTop: '1rem' }}>
                  <h3 className="settings-section-header">Ventas recientes</h3>
                  <p className="settings-section-desc">Comparativa de los ultimos dias con venta registrada.</p>
                  <div className="stats-daily">
                    {totals.byDay.map((day) => (
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
            </>
          )}
        </>
      )}
    </div>
  );
};

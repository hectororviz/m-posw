import { useMemo, useState } from 'react';
import { useAdminSales } from '../api/queries';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });

const normalizeAmount = (value?: number | string | null) => {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDateTime = (date?: string, time?: string, fallbackTime?: string) => {
  if (!date) {
    return null;
  }
  const safeTime = time || fallbackTime || '00:00';
  return new Date(`${date}T${safeTime}`);
};

const paymentLabels: Record<string, string> = {
  CASH: 'Efectivo',
  MP_QR: 'QR MercadoPago',
};

export const AdminStatsPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');

  const filteredSales = useMemo(() => {
    if (!startDate && !endDate) {
      return sales;
    }
    const start = buildDateTime(startDate, startTime, '00:00');
    const end = buildDateTime(endDate, endTime, '23:59');

    return sales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });
  }, [sales, startDate, startTime, endDate, endTime]);

  const productTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        totals.set(item.product.name, (totals.get(item.product.name) || 0) + item.quantity);
      });
    });
    return Array.from(totals.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [filteredSales]);

  const paymentTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredSales.forEach((sale) => {
      const method = sale.paymentMethod ?? 'CASH';
      const amount = normalizeAmount(sale.total);
      totals.set(method, (totals.get(method) || 0) + amount);
    });
    return Array.from(totals.entries()).map(([method, total]) => ({
      method,
      total,
    }));
  }, [filteredSales]);

  const paymentSummary = useMemo(() => {
    const totalAmount = paymentTotals.reduce((acc, item) => acc + item.total, 0);
    const palette = ['#38bdf8', '#f97316', '#a78bfa', '#4ade80'];
    let current = 0;
    const segments = paymentTotals.map((item, index) => {
      const percent = totalAmount ? (item.total / totalAmount) * 100 : 0;
      const start = current;
      const end = current + percent;
      current = end;
      return {
        ...item,
        percent,
        color: palette[index % palette.length],
        gradient: `${palette[index % palette.length]} ${start}% ${end}%`,
      };
    });
    const gradient = segments.length
      ? `conic-gradient(${segments.map((segment) => segment.gradient).join(', ')})`
      : 'conic-gradient(#e2e8f0 0% 100%)';
    return { totalAmount, segments, gradient };
  }, [paymentTotals]);

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    sales.forEach((sale) => {
      const dateKey = sale.createdAt.slice(0, 10);
      const amount = normalizeAmount(sale.total);
      totals.set(dateKey, (totals.get(dateKey) || 0) + amount);
    });
    const entries = Array.from(totals.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return entries.slice(-7);
  }, [sales]);

  const maxProduct = productTotals[0]?.quantity ?? 0;
  const maxDailyTotal = dailyTotals.reduce((acc, item) => Math.max(acc, item.total), 0);

  return (
    <section className="card admin-stats">
      <h2>Estadísticas</h2>
      <p>Selecciona un rango para analizar productos vendidos y medios de pago.</p>
      <div className="form-grid admin-stats__filters">
        <label className="input-field">
          Fecha desde
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="input-field">
          Hora desde
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="input-field">
          Fecha hasta
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label className="input-field">
          Hora hasta
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
      </div>

      <div className="admin-stats__grid">
        <article className="admin-stats__panel">
          <header>
            <h3>Productos vendidos</h3>
            <p>Totales por producto en el rango seleccionado.</p>
          </header>
          {productTotals.length === 0 ? (
            <div className="admin-stats__empty">No hay ventas en el rango elegido.</div>
          ) : (
            <div className="admin-stats__bar-chart">
              {productTotals.map((product) => (
                <div className="admin-stats__bar" key={product.name}>
                  <div className="admin-stats__bar-track">
                    <div
                      className="admin-stats__bar-fill"
                      style={{ width: `${(product.quantity / maxProduct) * 100}%` }}
                    />
                  </div>
                  <div className="admin-stats__bar-meta">
                    <span>{product.name}</span>
                    <strong>{product.quantity}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="admin-stats__panel">
          <header>
            <h3>Medio de pago</h3>
            <p>Distribución del total vendido por método.</p>
          </header>
          {paymentSummary.totalAmount === 0 ? (
            <div className="admin-stats__empty">No hay ventas en el rango elegido.</div>
          ) : (
            <div className="admin-stats__pie">
              <div className="admin-stats__pie-chart" style={{ background: paymentSummary.gradient }} />
              <div className="admin-stats__legend">
                {paymentSummary.segments.map((segment) => (
                  <div className="admin-stats__legend-item" key={segment.method}>
                    <span
                      className="admin-stats__legend-color"
                      style={{ background: segment.color }}
                    />
                    <div>
                      <strong>{paymentLabels[segment.method] ?? segment.method}</strong>
                      <span>{formatCurrency(segment.total)}</span>
                    </div>
                    <span className="admin-stats__legend-percent">
                      {segment.percent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <article className="admin-stats__panel admin-stats__panel--wide">
        <header>
          <h3>Totales de ventas recientes</h3>
          <p>Comparativa de los últimos días con venta registrada.</p>
        </header>
        {dailyTotals.length === 0 ? (
          <div className="admin-stats__empty">Todavía no hay ventas registradas.</div>
        ) : (
          <div className="admin-stats__daily-chart">
            {dailyTotals.map((day) => (
              <div className="admin-stats__daily-bar" key={day.date}>
                <div className="admin-stats__daily-bar-fill">
                  <span
                    style={{ height: `${maxDailyTotal ? (day.total / maxDailyTotal) * 100 : 0}%` }}
                  />
                </div>
                <div className="admin-stats__daily-meta">
                  <strong>{formatDateLabel(day.date)}</strong>
                  <span>{formatCurrency(day.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
};

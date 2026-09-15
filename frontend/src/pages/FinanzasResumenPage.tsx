import { useState } from 'react';
import { useFinanzasSummary } from '../api/queries';

const formatCurrency = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const FinanzasResumenPage: React.FC = () => {
  const toDate = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(toDate);

  const { data, isLoading } = useFinanzasSummary({ from: from || undefined, to: to || undefined });

  const expenses = (data?.byCategory ?? [])
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 8);
  const maxExpense = expenses[0]?.expense ?? 1;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Resumen de caja</h2>
          <p className="page-subtitle">Saldos por cuenta, ingresos y gastos del período</p>
        </div>
      </div>

      <div className="filter-bar finanzas-filters">
        <div className="filter-field">
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="filter-field">
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="loading-text">Cargando...</p>}

      {data && (
        <>
          <div className="summary-cards finanzas-cards">
            {data.accounts.map((a) => (
              <div key={a.id} className="summary-card summary-card--accent">
                <span className="summary-card__label">{a.name}</span>
                <span className="summary-card__value">{formatCurrency(a.balance)}</span>
              </div>
            ))}
            <div className="summary-card summary-card--success">
              <span className="summary-card__label">Total ingresos</span>
              <span className="summary-card__value">{formatCurrency(data.totalIncome)}</span>
            </div>
            <div className="summary-card summary-card--danger">
              <span className="summary-card__label">Total gastos</span>
              <span className="summary-card__value">{formatCurrency(data.totalExpense)}</span>
            </div>
            <div className="summary-card summary-card--info">
              <span className="summary-card__label">Resultado</span>
              <span className="summary-card__value">{formatCurrency(data.netResult)}</span>
            </div>
          </div>

          <div className="section">
            <h3>Gastos por categoría</h3>
            {expenses.length === 0 ? (
              <p className="empty-text">Sin gastos en el período.</p>
            ) : (
              <div className="finanzas-bars">
                {expenses.map((c) => (
                  <div key={c.id} className="finanzas-bar-row">
                    <span className="finanzas-bar-label">{c.name}</span>
                    <div className="finanzas-bar-track">
                      <div
                        className="finanzas-bar-fill"
                        style={{ width: `${Math.max(4, (c.expense / maxExpense) * 100)}%` }}
                      />
                    </div>
                    <span className="finanzas-bar-value">{formatCurrency(c.expense)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h3>Ventas diarias del período</h3>
            {data.dailySales.length === 0 ? (
              <p className="empty-text">No hay ventas registradas.</p>
            ) : (
              <div className="treasury-table-wrapper">
                <div className="treasury-table finanzas-table">
                  <div className="treasury-table-head finanzas-row">
                    <span>Fecha</span>
                    <span>Cuenta</span>
                    <span>Ventas</span>
                    <span className="num">Total</span>
                  </div>
                  {data.dailySales.map((d) => (
                    <div key={`${d.date}-${d.method}`} className="treasury-table-row finanzas-row">
                      <span>{d.date.split('-').reverse().join('/')}</span>
                      <span>{d.method === 'CASH' ? 'Efectivo' : 'Mercado Pago'}</span>
                      <span>{d.count}</span>
                      <span className="num">{formatCurrency(d.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

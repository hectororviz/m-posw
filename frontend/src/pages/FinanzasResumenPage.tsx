import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanzasMonthly, useFinanzasSummary, useMpAuditoriaStatus } from '../api/queries';
import { formatDate, formatMoney } from '../utils/format';

const formatCurrency = (n: number) => formatMoney(n);

export const FinanzasResumenPage: React.FC = () => {
  const navigate = useNavigate();
  const toDate = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(toDate);

  const { data, isLoading } = useFinanzasSummary({ from: from || undefined, to: to || undefined });
  const year = Number((to || toDate).slice(0, 4));
  const { data: monthly = [] } = useFinanzasMonthly(year);
  const { data: mpStatus } = useMpAuditoriaStatus();

  const openRubro = (id: string) =>
    navigate(`/admin/tesoreria/rubros/${id}?from=${from}&to=${to}`);

  const expenses = (data?.byCategory ?? [])
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 8);
  const maxExpense = expenses[0]?.expense ?? 1;

  const incomes = (data?.byCategory ?? [])
    .filter((c) => c.income > 0)
    .sort((a, b) => b.income - a.income)
    .slice(0, 8);
  const maxIncome = incomes[0]?.income ?? 1;

  return (
    <>
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
            {mpStatus?.disponible != null && (
              <div className="summary-card summary-card--info">
                <span className="summary-card__label">Saldo disponible MP</span>
                <span className="summary-card__value">{formatCurrency(mpStatus.disponible)}</span>
                {mpStatus?.disponibleAt ? (
                  <span className="summary-card__meta">al {formatDate(mpStatus.disponibleAt)}</span>
                ) : null}
              </div>
            )}
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
            {data.operativoNet !== undefined && (data.operativoNet !== data.netResult) && (
              <div className="summary-card">
                <span className="summary-card__label">Resultado operativo</span>
                <span className="summary-card__value">{formatCurrency(data.operativoNet)}</span>
              </div>
            )}
          </div>

          <div className="section">
            <h3>Gastos por rubro</h3>
            {expenses.length === 0 ? (
              <p className="empty-text">Sin gastos en el período.</p>
            ) : (
              <div className="finanzas-bars">
                {expenses.map((c) => (
                  <button key={c.id} className="finanzas-bar-row as-link" onClick={() => openRubro(c.id)}>
                    <span className="finanzas-bar-label">{c.name}</span>
                    <div className="finanzas-bar-track">
                      <div
                        className="finanzas-bar-fill"
                        style={{ width: `${Math.max(4, (c.expense / maxExpense) * 100)}%` }}
                      />
                    </div>
                    <span className="finanzas-bar-value">{formatCurrency(c.expense)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h3>Ingresos por rubro</h3>
            {incomes.length === 0 ? (
              <p className="empty-text">Sin ingresos en el período.</p>
            ) : (
              <div className="finanzas-bars">
                {incomes.map((c) => (
                  <button key={c.id} className="finanzas-bar-row as-link" onClick={() => openRubro(c.id)}>
                    <span className="finanzas-bar-label">{c.name}</span>
                    <div className="finanzas-bar-track">
                      <div
                        className="finanzas-bar-fill finanzas-bar-fill--in"
                        style={{ width: `${Math.max(4, (c.income / maxIncome) * 100)}%` }}
                      />
                    </div>
                    <span className="finanzas-bar-value">{formatCurrency(c.income)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <h3>Cortes mensuales {year}</h3>
            {monthly.length === 0 ? (
              <p className="empty-text">Sin movimientos este año.</p>
            ) : (
              <div className="treasury-table-wrapper">
                <div className="treasury-table finanzas-table">
                  <div className="treasury-table-head finanzas-row">
                    <span>Mes</span>
                    <span className="num">Ingresos</span>
                    <span className="num">Gastos</span>
                    <span className="num">Neto</span>
                  </div>
                  {monthly.map((m) => (
                    <div key={m.month} className="treasury-table-row finanzas-row">
                      <span>{m.month}</span>
                      <span className="num">{formatCurrency(m.income)}</span>
                      <span className="num">{formatCurrency(m.expense)}</span>
                      <span className="num">{formatCurrency(m.net)}</span>
                    </div>
                  ))}
                </div>
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

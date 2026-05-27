import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAccountingMovements, useAccountingSummary } from '../api/queries';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const getMonthRange = (date: Date) => {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { from: from.toISOString(), to: to.toISOString() };
};

const getLast6MonthsRange = () => {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  return { from: start.toISOString(), to: end.toISOString() };
};

export const AccountingDashboard: React.FC = () => {
  const now = new Date();
  const currentMonth = getMonthRange(now);
  const last6Months = getLast6MonthsRange();

  const { data: summary } = useAccountingSummary(currentMonth);
  const { data: monthlySummary } = useAccountingSummary(last6Months);
  const { data: movements = [] } = useAccountingMovements(last6Months);

  const lastMovements = useMemo(() => movements.slice(0, 5), [movements]);

  const monthlyData = useMemo(() => {
    return (monthlySummary?.monthlySeries ?? []).slice(-6);
  }, [monthlySummary]);

  const maxMonthlyValue = useMemo(() => {
    let max = 0;
    monthlyData.forEach((m) => {
      max = Math.max(max, m.income, m.expense);
    });
    return max || 1;
  }, [monthlyData]);

  const expenseByCategory = useMemo(() => {
    return (summary?.byCategory ?? []).filter((c) => c.type === 'EXPENSE' && c.total > 0);
  }, [summary]);

  const totalExpenseCategory = useMemo(
    () => expenseByCategory.reduce((acc, c) => acc + c.total, 0),
    [expenseByCategory],
  );

  const pieGradient = useMemo(() => {
    if (expenseByCategory.length === 0) return 'conic-gradient(var(--color-border) 0% 100%)';
    const palette = [getComputedStyle(document.documentElement).getPropertyValue('--chart-2').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-5').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-6').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-7').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-8').trim(), 'var(--color-accent)', getComputedStyle(document.documentElement).getPropertyValue('--chart-9').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-10').trim()];
    let current = 0;
    const segments = expenseByCategory.map((cat, i) => {
      const pct = totalExpenseCategory ? (cat.total / totalExpenseCategory) * 100 : 0;
      const start = current;
      const end = current + pct;
      current = end;
      return {
        ...cat,
        pct,
        color: palette[i % palette.length],
        gradient: `${palette[i % palette.length]} ${start.toFixed(1)}% ${end.toFixed(1)}%`,
      };
    });
    return `conic-gradient(${segments.map((s) => s.gradient).join(', ')})`;
  }, [expenseByCategory, totalExpenseCategory]);

  return (
    <section className="card accounting-dashboard">
      <h2>Dashboard Contable</h2>

      <nav className="accounting-nav">
        <NavLink to="/admin/contabilidad" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/admin/contabilidad/movimientos" className={({ isActive }) => (isActive ? 'active' : '')}>
          Movimientos
        </NavLink>
        <NavLink to="/admin/contabilidad/jornadas" className={({ isActive }) => (isActive ? 'active' : '')}>
          Jornadas
        </NavLink>
        <NavLink to="/admin/contabilidad/categorias" className={({ isActive }) => (isActive ? 'active' : '')}>
          Categorías
        </NavLink>
        <NavLink to="/admin/contabilidad/exportar" className={({ isActive }) => (isActive ? 'active' : '')}>
          Exportar
        </NavLink>
      </nav>

      <div className="accounting-summary-cards">
        <div className="accounting-summary-card income">
          <span className="accounting-summary-card__label">Ingresos del mes</span>
          <span className="accounting-summary-card__value">{formatCurrency(summary?.totalIncome ?? 0)}</span>
        </div>
        <div className="accounting-summary-card expense">
          <span className="accounting-summary-card__label">Egresos del mes</span>
          <span className="accounting-summary-card__value">{formatCurrency(summary?.totalExpense ?? 0)}</span>
        </div>
        <div className="accounting-summary-card net">
          <span className="accounting-summary-card__label">Saldo neto del mes</span>
          <span className="accounting-summary-card__value">{formatCurrency(summary?.netBalance ?? 0)}</span>
        </div>
        <div className="accounting-summary-card sales">
          <span className="accounting-summary-card__label">Ventas de jornada del mes</span>
          <span className="accounting-summary-card__value">{formatCurrency(summary?.jornadaSalesTotal ?? 0)}</span>
        </div>
      </div>

      <div className="admin-stats__grid">
        <article className="admin-stats__panel">
          <header>
            <h3>Ingresos vs Egresos (últimos 6 meses)</h3>
          </header>
          {monthlyData.length === 0 ? (
            <div className="admin-stats__empty">Sin datos disponibles.</div>
          ) : (
            <div className="accounting-monthly-chart">
              {monthlyData.map((m) => {
                const [year, monthNum] = m.month.split('-');
                const label = `${MONTHS_ES[Number(monthNum) - 1]} ${year.slice(2)}`;
                return (
                  <div className="accounting-monthly-bar-group" key={m.month}>
                    <div className="accounting-monthly-bars">
                      <div
                        className="accounting-monthly-bar-fill income-bar"
                        style={{ height: `${(m.income / maxMonthlyValue) * 100}%` }}
                      />
                      <div
                        className="accounting-monthly-bar-fill expense-bar"
                        style={{ height: `${(m.expense / maxMonthlyValue) * 100}%` }}
                      />
                    </div>
                    <div className="accounting-monthly-meta">
                      <span>{label}</span>
                      <small>
                        <span className="income-dot" /> {formatCurrency(m.income)}
                      </small>
                      <small>
                        <span className="expense-dot" /> {formatCurrency(m.expense)}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="admin-stats__panel">
          <header>
            <h3>Egresos por categoría (mes actual)</h3>
          </header>
          {expenseByCategory.length === 0 ? (
            <div className="admin-stats__empty">Sin egresos en el mes actual.</div>
          ) : (
            <div className="admin-stats__pie">
              <div className="admin-stats__pie-chart" style={{ background: pieGradient }} />
              <div className="admin-stats__legend">
                {expenseByCategory.map((cat, i) => {
                  const palette = [getComputedStyle(document.documentElement).getPropertyValue('--chart-2').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-5').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-6').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-7').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-8').trim(), 'var(--color-accent)', getComputedStyle(document.documentElement).getPropertyValue('--chart-9').trim(), getComputedStyle(document.documentElement).getPropertyValue('--chart-10').trim()];
                  return (
                    <div className="admin-stats__legend-item" key={cat.categoryId}>
                      <span className="admin-stats__legend-color" style={{ background: palette[i % palette.length] }} />
                      <div>
                        <strong>{cat.categoryName}</strong>
                        <span>{formatCurrency(cat.total)}</span>
                      </div>
                      <span className="admin-stats__legend-percent">
                        {totalExpenseCategory ? ((cat.total / totalExpenseCategory) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      </div>

      <article className="admin-stats__panel admin-stats__panel--wide">
        <header>
          <h3>Últimos movimientos extra-jornada</h3>
        </header>
        {lastMovements.length === 0 ? (
          <div className="admin-stats__empty">Sin movimientos registrados.</div>
        ) : (
          <div className="product-table">
            <div className="product-table-header product-table-header--5">
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Categoría</span>
              <span>Descripción</span>
              <span>Monto</span>
            </div>
            {lastMovements.map((m) => (
              <div className="product-table-row product-table-row--5" key={m.id}>
                <span>{formatDate(m.date)}</span>
                <span className={m.type === 'INCOME' ? 'text-green' : 'text-red'}>
                  {m.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                </span>
                <span>{m.category?.name ?? '-'}</span>
                <span>{m.description}</span>
                <span className={m.type === 'INCOME' ? 'text-green' : 'text-red'}>
                  {formatCurrency(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
};

import { useState } from 'react';
import { useTreasurySummary } from '../api/queries';


const formatCurrency = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-success',
    VOIDED: 'badge badge-warning',
  };
  return map[status] || 'badge badge-neutral';
};

export const TreasurySummaryPage: React.FC = () => {
  const toDate = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(toDate);

  const { data, isLoading } = useTreasurySummary({ from: from || undefined, to: to || undefined });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Resumen de Tesorería</h2>
          <p className="page-subtitle">Panel de disponibilidades, ingresos y gastos</p>
        </div>
      </div>

      <div className="filter-bar">
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
          <div className="summary-cards">
            <div className="summary-card summary-card--accent">
              <span className="summary-card__label">Caja - Efectivo</span>
              <span className="summary-card__value">
                {formatCurrency(data.availabilities.accounts.find((a) => a.code === '1.1.01')?.balance || 0)}
              </span>
            </div>
            <div className="summary-card summary-card--accent">
              <span className="summary-card__label">Mercado Pago</span>
              <span className="summary-card__value">
                {formatCurrency(data.availabilities.accounts.find((a) => a.code === '1.1.02')?.balance || 0)}
              </span>
            </div>
            <div className="summary-card summary-card--accent">
              <span className="summary-card__label">Banco</span>
              <span className="summary-card__value">
                {formatCurrency(data.availabilities.accounts.find((a) => a.code === '1.1.03')?.balance || 0)}
              </span>
            </div>
            <div className="summary-card summary-card--success">
              <span className="summary-card__label">Total Ingresos</span>
              <span className="summary-card__value">{formatCurrency(data.incomeStatement.totalRevenue)}</span>
            </div>
            <div className="summary-card summary-card--danger">
              <span className="summary-card__label">Total Gastos</span>
              <span className="summary-card__value">{formatCurrency(data.incomeStatement.totalExpense)}</span>
            </div>
            <div className="summary-card summary-card--info">
              <span className="summary-card__label">Resultado</span>
              <span className="summary-card__value">{formatCurrency(data.incomeStatement.netResult)}</span>
            </div>
          </div>

          <div className="section">
            <h3>Últimos movimientos</h3>
            {data.lastEntries.length === 0 ? (
              <p className="empty-text">No hay movimientos registrados.</p>
            ) : (
              <div className="treasury-table-wrapper">
                <div className="treasury-table">
                  <div className="treasury-table-head">
                    <span>Asiento</span>
                    <span>Fecha</span>
                    <span>Descripción</span>
                    <span>Estado</span>
                    <span>Creado por</span>
                  </div>
                  {data.lastEntries.map((e) => (
                    <div key={e.id} className="treasury-table-row">
                      <span>{e.entryNumber}</span>
                      <span>{formatDate(e.date)}</span>
                      <span className="truncate">{e.description}</span>
                      <span><span className={statusBadge(e.status)}>{e.status === 'DRAFT' ? 'Borrador' : e.status === 'POSTED' ? 'Confirmado' : 'Anulado'}</span></span>
                      <span>{e.createdBy?.name || '-'}</span>
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

import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useFinanzasRubroDetail, useMoneyAccounts } from '../api/queries';
import type { FinanzasMovement } from '../api/types';

const formatCurrency = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const sourceBadge = (m: FinanzasMovement) => {
  if (m.source === 'VENTA_DIARIA') return <span className="badge badge-success">Venta diaria</span>;
  if (m.source === 'COBRO_FIADO') return <span className="badge badge-info">Cobro fiado</span>;
  if (m.source === 'CUOTA_SOCIO') return <span className="badge badge-info">Cuota socio</span>;
  if (m.voided) return <span className="badge badge-warning">Anulado</span>;
  return <span className="badge badge-neutral">Manual</span>;
};

export const FinanzasRubroPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();

  const [from, setFrom] = useState(
    () =>
      searchParams.get('from') ??
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 10);
      })(),
  );
  const [to, setTo] = useState(
    () => searchParams.get('to') ?? new Date().toISOString().slice(0, 10),
  );
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: accounts = [] } = useMoneyAccounts();
  const { data, isLoading } = useFinanzasRubroDetail(categoryId, {
    from: from || undefined,
    to: to || undefined,
    accountId: accountId || undefined,
    search: search || undefined,
    page,
    limit: 30,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.movements.total / data.movements.limit)) : 1;

  return (
    <div className="finanzas-page">
      <div className="page-header">
        <div>
          <Link to="/admin/tesoreria" className="btn-ghost finanzas-back">
            <ArrowLeft size={16} /> Resumen
          </Link>
          <h2>{data?.category.name ?? 'Rubro'}</h2>
          <p className="page-subtitle">Estado y movimientos del rubro en el período</p>
        </div>
      </div>

      <div className="filter-bar finanzas-filters">
        <div className="filter-field">
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="filter-field">
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="filter-field">
          <label>Cuenta</label>
          <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field finanzas-search">
          <label>Buscar</label>
          <input
            type="search"
            placeholder="Descripción..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading && <p className="loading-text">Cargando...</p>}

      {data && (
        <>
          <div className="summary-cards finanzas-cards">
            <div className="summary-card summary-card--success">
              <span className="summary-card__label">Total ingresos</span>
              <span className="summary-card__value">{formatCurrency(data.totals.income)}</span>
            </div>
            <div className="summary-card summary-card--danger">
              <span className="summary-card__label">Total egresos</span>
              <span className="summary-card__value">{formatCurrency(data.totals.expense)}</span>
            </div>
            <div className="summary-card summary-card--info">
              <span className="summary-card__label">Neto ({data.totals.count} mov.)</span>
              <span className="summary-card__value">{formatCurrency(data.totals.net)}</span>
            </div>
          </div>

          {data.movements.data.length === 0 ? (
            <p className="empty-text">No hay movimientos en el período.</p>
          ) : (
            <div className="finanzas-list">
              {data.movements.data.map((m) => (
                <div key={m.id} className={`finanzas-card${m.voided ? ' is-voided' : ''}`}>
                  <div className="finanzas-card-main">
                    <span className="finanzas-card-date">{formatDate(m.date)}</span>
                    <div className="finanzas-card-body">
                      <strong className="finanzas-card-desc">{m.description}</strong>
                      <span className="finanzas-card-meta">{m.accountName}</span>
                    </div>
                  </div>
                  <div className="finanzas-card-side">
                    {m.amountIn > 0 && (
                      <span className="finanzas-amount in">+{formatCurrency(m.amountIn)}</span>
                    )}
                    {m.amountOut > 0 && (
                      <span className="finanzas-amount out">−{formatCurrency(m.amountOut)}</span>
                    )}
                    <span className="finanzas-card-badges">{sourceBadge(m)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="finanzas-pager">
              <button
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

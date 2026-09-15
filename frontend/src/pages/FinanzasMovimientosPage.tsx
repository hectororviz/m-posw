import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Ban } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useFinanzasMovements, useMoneyAccounts, useMoneyCategories } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';
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

export const FinanzasMovimientosPage: React.FC = () => {
  const access = useModuleAccess('TESORERIA');
  const canWrite = access === 'FULL';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const toDate = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(toDate);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: accounts = [] } = useMoneyAccounts();
  const { data: categories = [] } = useMoneyCategories();
  const { data, isLoading } = useFinanzasMovements({
    from: from || undefined,
    to: to || undefined,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    search: search || undefined,
    page,
    limit: 30,
  });

  // Modal nuevo movimiento
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<'EGRESO' | 'INGRESO'>('EGRESO');
  const [amount, setAmount] = useState('');
  const [mAccountId, setMAccountId] = useState('');
  const [mCategoryId, setMCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [mDate, setMDate] = useState(toDate);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setKind('EGRESO');
    setAmount('');
    setMAccountId(accounts[0]?.id ?? '');
    setMCategoryId('');
    setDescription('');
    setMDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const visibleCategories = categories.filter(
    (c) => c.kind === 'AMBOS' || c.kind === kind,
  );

  const handleSave = async () => {
    const value = Number(String(amount).replace(',', '.'));
    if (!value || value <= 0) {
      pushToast('Ingresá un monto mayor a 0', 'error');
      return;
    }
    if (!mAccountId || !mCategoryId || !description.trim()) {
      pushToast('Completá cuenta, categoría y descripción', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/finanzas/movements', {
        kind,
        amount: value,
        accountId: mAccountId,
        categoryId: mCategoryId,
        description: description.trim(),
        date: mDate || undefined,
      });
      pushToast(kind === 'EGRESO' ? 'Gasto registrado' : 'Ingreso registrado', 'success');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finanzas-movements'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (id: string) => {
    if (!window.confirm('¿Anular este movimiento?')) return;
    try {
      await apiClient.post(`/finanzas/movements/${id}/anular`, {});
      pushToast('Movimiento anulado', 'success');
      queryClient.invalidateQueries({ queryKey: ['finanzas-movements'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="finanzas-page">
      <div className="page-header">
        <div>
          <h2>Movimientos</h2>
          <p className="page-subtitle">Compras, gastos, cobros y ventas diarias</p>
        </div>
        {canWrite && (
          <button className="btn-primary finanzas-fab-btn" onClick={openModal}>
            <Plus size={18} /> <span className="finanzas-fab-label">Compra / Gasto</span>
          </button>
        )}
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
        <div className="filter-field">
          <label>Categoría</label>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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

      {data && data.data.length === 0 && (
        <p className="empty-text">No hay movimientos en el período.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="finanzas-list">
          {data.data.map((m) => (
            <div key={m.id} className={`finanzas-card${m.voided ? ' is-voided' : ''}`}>
              <div className="finanzas-card-main">
                <span className="finanzas-card-date">{formatDate(m.date)}</span>
                <div className="finanzas-card-body">
                  <strong className="finanzas-card-desc">{m.description}</strong>
                  <span className="finanzas-card-meta">
                    {m.categoryName} · {m.accountName}
                  </span>
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
                {canWrite && m.source === 'MANUAL' && !m.voided && (
                  <button
                    className="btn-ghost finanzas-void"
                    title="Anular"
                    onClick={() => handleVoid(m.id)}
                  >
                    <Ban size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
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

      {modalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setModalOpen(false)}>
          <div className="modal-card finanzas-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva compra / gasto</h3>

            <div className="finanzas-kind-toggle">
              <button
                className={kind === 'EGRESO' ? 'active out' : ''}
                onClick={() => { setKind('EGRESO'); setMCategoryId(''); }}
              >
                Gasto
              </button>
              <button
                className={kind === 'INGRESO' ? 'active in' : ''}
                onClick={() => { setKind('INGRESO'); setMCategoryId(''); }}
              >
                Ingreso
              </button>
            </div>

            <div className="settings-field">
              <label>Monto</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0.00"
                autoFocus
                className="finanzas-amount-input"
              />
            </div>

            <div className="settings-field">
              <label>De dónde {kind === 'EGRESO' ? 'salió' : 'ingresó'} el dinero</label>
              <div className="finanzas-chips">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    className={mAccountId === a.id ? 'chip active' : 'chip'}
                    onClick={() => setMAccountId(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-field">
              <label>Categoría</label>
              <select value={mCategoryId} onChange={(e) => setMCategoryId(e.target.value)}>
                <option value="">Elegí una categoría...</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label>Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Factura B 0001 - carne"
                maxLength={200}
              />
            </div>

            <div className="settings-field">
              <label>Fecha</label>
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" disabled={saving} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

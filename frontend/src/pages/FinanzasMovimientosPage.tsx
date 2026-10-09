import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Ban } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useFinanzasMovements, useMoneyAccounts, useMoneyCategories, useResponsables } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';
import { ConfirmDialog } from '../components/ui/Modal';
import type { FinanzasMovement } from '../api/types';
import { formatDate, formatMoney } from '../utils/format';

const formatCurrency = (n: number) => formatMoney(n);

const formatDateLabel = (d: string) => formatDate(d).slice(0, 5);

const sourceBadge = (m: FinanzasMovement) => {
  if (m.source === 'VENTA_GRUPO') return <span className="badge badge-success">Ventas del día ({m.salesCount})</span>;
  if (m.source === 'VENTA' || m.source === 'VENTA_DIARIA') return <span className="badge badge-success">Venta</span>;
  if (m.source === 'COBRO_FIADO') return <span className="badge badge-info">Cobro fiado</span>;
  if (m.source === 'CUOTA_SOCIO') return <span className="badge badge-info">Cuota socio</span>;
  if (m.source === 'TRASPASO') return <span className="badge badge-info">Traspaso</span>;
  if (m.source === 'MP_SYNC') return <span className="badge badge-info">Mercado Pago</span>;
  if (m.voided) return <span className="badge badge-warning">Anulado</span>;
  return <span className="badge badge-neutral">Manual</span>;
};

export const FinanzasMovimientosPage: React.FC<{
  fixedAccountId?: string;
  hideAccountFilter?: boolean;
}> = ({ fixedAccountId, hideAccountFilter = false }) => {
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
  const { data: responsables = [] } = useResponsables();
  const effectiveAccountId = fixedAccountId ?? accountId;
  const { data, isLoading } = useFinanzasMovements({
    from: from || undefined,
    to: to || undefined,
    accountId: effectiveAccountId || undefined,
    categoryId: categoryId || undefined,
    search: search || undefined,
    groupVentas: '1',
    page,
    limit: 30,
  });
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const expandedDay = expandedGroup ? expandedGroup.replace('grupo-venta-', '').split('-').slice(0, 3).join('-') : null;
  const { data: groupChildren } = useFinanzasMovements({
    from: expandedDay ?? undefined,
    to: expandedDay ?? undefined,
    accountId: effectiveAccountId || undefined,
    source: 'VENTA',
    page: 1,
    limit: 100,
  }, Boolean(expandedDay));

  // Modal nuevo movimiento
  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<'EGRESO' | 'INGRESO'>('EGRESO');
  const [amount, setAmount] = useState('');
  const [mAccountId, setMAccountId] = useState('');
  const [mCategoryId, setMCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [concepto, setConcepto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [mDate, setMDate] = useState(toDate);
  const [saving, setSaving] = useState(false);
  // Modal traspaso
  const [traspasoOpen, setTraspasoOpen] = useState(false);
  const [tAmount, setTAmount] = useState('');
  const [tToAccount, setTToAccount] = useState('');
  const [tResponsable, setTResponsable] = useState('');
  const [tObs, setTObs] = useState('');

  const openModal = () => {
    setKind('EGRESO');
    setAmount('');
    setMAccountId(fixedAccountId ?? accounts[0]?.id ?? '');
    setMCategoryId('');
    setDescription('');
    setConcepto('');
    setObservaciones('');
    setResponsableId('');
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
        concepto: concepto.trim() || undefined,
        description: description.trim(),
        observaciones: observaciones.trim() || undefined,
        responsableId: responsableId || undefined,
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

  const handleTraspaso = async () => {
    const value = Number(String(tAmount).replace(',', '.'));
    if (!value || value <= 0 || !tToAccount) {
      pushToast('Ingresá monto y cuenta destino', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/finanzas/traspasos', {
        fromAccountId: fixedAccountId || effectiveAccountId,
        toAccountId: tToAccount,
        amount: value,
        responsableId: tResponsable || undefined,
        observaciones: tObs.trim() || undefined,
      });
      pushToast('Traspaso registrado', 'success');
      setTraspasoOpen(false);
      setTAmount('');
      queryClient.invalidateQueries({ queryKey: ['finanzas-movements'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const handleVoid = async () => {
    if (!voidTarget || voiding) return;
    setVoiding(true);
    try {
      await apiClient.post(`/finanzas/movements/${voidTarget}/anular`, {});
      pushToast('Movimiento anulado', 'success');
      queryClient.invalidateQueries({ queryKey: ['finanzas-movements'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
      setVoidTarget(null);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setVoiding(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="finanzas-page">
      {canWrite && (
        <div className="ui-toolbar">
          <span className="spacer" />
          {fixedAccountId && (
            <button className="btn-ghost finanzas-fab-btn" onClick={() => { setTToAccount(''); setTraspasoOpen(true); }}>
              <span className="finanzas-fab-label">Traspaso</span>
            </button>
          )}
          <button className="btn-primary finanzas-fab-btn" onClick={openModal}>
            <Plus size={18} /> <span className="finanzas-fab-label">Compra / Gasto</span>
          </button>
        </div>
      )}

      <div className="filter-bar finanzas-filters">
        <div className="filter-field">
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="filter-field">
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        {!hideAccountFilter && (
          <div className="filter-field">
            <label>Cuenta</label>
            <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
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
            <div key={m.id}>
              <div
                className={`finanzas-card${m.voided ? ' is-voided' : ''}`}
                style={m.source === 'VENTA_GRUPO' ? { cursor: 'pointer' } : undefined}
                onClick={m.source === 'VENTA_GRUPO' ? () => setExpandedGroup(expandedGroup === m.id ? null : m.id) : undefined}
              >
                <div className="finanzas-card-main">
                  <span className="finanzas-card-date">{formatDateLabel(m.date)}</span>
                  <div className="finanzas-card-body">
                    <strong className="finanzas-card-desc">
                      {m.source === 'VENTA_GRUPO' ? `${expandedGroup === m.id ? '▾' : '▸'} ` : ''}{m.concepto || m.description}
                    </strong>
                    <span className="finanzas-card-meta">
                      {m.categoryName} · {m.accountName}
                      {m.responsableNombre ? ` · ${m.responsableNombre}` : ''}
                    </span>
                    {m.observaciones && (
                      <span className="finanzas-card-meta">{m.observaciones}</span>
                    )}
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
                  {canWrite && (m.source === 'MANUAL' || m.source === ('TRASPASO' as string)) && !m.voided && (m.source as string) !== 'VENTA_GRUPO' && (
                    <button
                      className="btn-ghost finanzas-void"
                      title="Anular"
                      onClick={(e) => { e.stopPropagation(); setVoidTarget(m.id); }}
                    >
                      <Ban size={15} />
                    </button>
                  )}
                </div>
              </div>
              {m.source === 'VENTA_GRUPO' && expandedGroup === m.id && groupChildren && (
                <div style={{ marginLeft: 24 }}>
                  {groupChildren.data.map((c) => (
                    <div key={c.id} className="finanzas-card">
                      <div className="finanzas-card-main">
                        <span className="finanzas-card-date">{formatDateLabel(c.date)}</span>
                        <div className="finanzas-card-body">
                          <strong className="finanzas-card-desc">{c.concepto || c.description}</strong>
                          <span className="finanzas-card-meta">{c.categoryName}</span>
                        </div>
                      </div>
                      <div className="finanzas-card-side">
                        <span className="finanzas-amount in">+{formatCurrency(c.amountIn)}</span>
                        <span className="finanzas-card-badges">{sourceBadge(c)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

            {!fixedAccountId && (
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
            )}

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
              <label>Concepto</label>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Milanesa x 20"
                maxLength={120}
              />
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
              <label>Responsable</label>
              <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                <option value="">Sin asignar</option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label>Observaciones</label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Jornada vs Ipa"
                maxLength={500}
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

      {traspasoOpen && (
        <div className="modal-overlay" onClick={() => !saving && setTraspasoOpen(false)}>
          <div className="modal-card finanzas-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Traspaso interno (Cambio Caja)</h3>
            <div className="settings-field">
              <label>Monto</label>
              <input
                type="text"
                inputMode="decimal"
                value={tAmount}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setTAmount(v);
                }}
                placeholder="0.00"
                autoFocus
                className="finanzas-amount-input"
              />
            </div>
            <div className="settings-field">
              <label>Cuenta destino</label>
              <select value={tToAccount} onChange={(e) => setTToAccount(e.target.value)}>
                <option value="">Elegí destino...</option>
                {accounts.filter((a) => a.id !== (fixedAccountId || effectiveAccountId)).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label>Responsable</label>
              <select value={tResponsable} onChange={(e) => setTResponsable(e.target.value)}>
                <option value="">Sin asignar</option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label>Observaciones</label>
              <input type="text" value={tObs} onChange={(e) => setTObs(e.target.value)} maxLength={500} />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" disabled={saving} onClick={() => setTraspasoOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={saving} onClick={handleTraspaso}>
                {saving ? 'Guardando...' : 'Guardar traspaso'}
              </button>
            </div>
          </div>
        </div>
      )}
      {voidTarget && (
        <ConfirmDialog
          title="Anular el movimiento"
          message="Se anulará el movimiento. Esta acción no se puede deshacer."
          confirmLabel="Anular"
          busy={voiding}
          onCancel={() => { if (!voiding) setVoidTarget(null); }}
          onConfirm={handleVoid}
        />
      )}
    </div>
  );
};

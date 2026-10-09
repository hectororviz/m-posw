import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useMpAuditoria, useMpAuditoriaDetail, useMpAuditoriaStatus, useMoneyCategories, useResponsables } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';
import type { MpAuditEstado, MpAuditoriaItem } from '../api/types';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';

const SESSION_KEY = 'mp-audit-synced';

const formatCurrency = (n: number) => formatMoney(n);

const formatDateLabel = (d: string) => formatDate(d).slice(0, 5);

const estadoBadge = (e: MpAuditEstado) => {
  if (e === 'CONCILIADO') return <span className="badge badge-success">Conciliado</span>;
  if (e === 'SUGERIDO') return <span className="badge badge-info">Sugerido</span>;
  if (e === 'IGNORADO') return <span className="badge badge-neutral">Ignorado</span>;
  return <span className="badge badge-warning">Sin catalogar</span>;
};

const tipoLabel: Record<string, string> = {
  COBRO_QR: 'QR',
  TRANSFERENCIA: 'Transferencia',
  RETIRO: 'Retiro',
  GASTO: 'Gasto',
  FEE: 'Comisión',
  REFUND: 'Reembolso',
  CHARGEBACK: 'Contracargo',
  OTRO: 'Otro',
};

const OUTFLOW_TIPOS = new Set(['RETIRO', 'GASTO', 'FEE', 'REFUND', 'CHARGEBACK']);

export const MpAuditoriaPage: React.FC = () => {
  const access = useModuleAccess('TESORERIA');
  const canWrite = access === 'FULL';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const toDate = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState(toDate);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading } = useMpAuditoria({
    from: from || undefined,
    to: to || undefined,
    estado: (onlyPending ? '' : estado) || undefined,
    tipo: tipo || undefined,
    search: search || undefined,
    page,
    limit: 30,
  });
  const { data: status, refetch: refetchStatus } = useMpAuditoriaStatus();
  const { data: detail } = useMpAuditoriaDetail(selectedId ?? undefined);
  const { data: categories = [] } = useMoneyCategories();
  const { data: responsables = [] } = useResponsables();

  const [catId, setCatId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [respId, setRespId] = useState('');

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mp-auditoria'] });
    await refetchStatus();
  };

  const doSync = async (silent = false) => {
    if (!canWrite || syncing) return;
    setSyncing(true);
    try {
      await apiClient.post('/mp-auditoria/sync', {});
      await refresh();
      if (!silent) pushToast('Sincronizado con Mercado Pago', 'success');
    } catch (err) {
      if (!silent) pushToast(normalizeApiError(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const reconcile = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await apiClient.post('/mp-auditoria/reconciliar', {});
      pushToast(`Asociadas ${res.data.vinculados} ventas, ${res.data.sugeridos} sugeridas (${res.data.pendientes} pendientes)`, 'success');
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const releaseSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await apiClient.post('/mp-auditoria/release-sync', {});
      const n = res.data?.salidasImportadas;
      pushToast(
        res.data?.descargado
          ? `Salidas MP sincronizadas (${n ?? 0} importadas)`
          : 'Salidas MP: reporte pedido, aún no listo; se reintenta en el próximo ciclo',
        'success',
      );
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Sync 1× por sesión al abrir la página (navegar entre tabs no re-sincroniza)
  useEffect(() => {
    if (!canWrite) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    void doSync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (detail) {
      setCatId('');
      setConcepto(detail.pagador ?? '');
      setObservaciones('');
      setRespId('');
    }
  }, [detail?.id]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pendientes = data?.resumen.filter((r) => r.estado === 'PENDIENTE' || r.estado === 'SUGERIDO')
    .reduce((a, r) => a + r.total, 0) ?? 0;

  const act = async (url: string, body: unknown, msg: string) => {
    try {
      await apiClient.post(url, body);
      pushToast(msg, 'success');
      setSelectedId(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  return (
    <div className="finanzas-page">
      <div className="page-header">
        <div>
          <h2>Auditoría Mercado Pago</h2>
          <p className="page-subtitle">
            Movimientos de la cuenta MP y su vínculo con el sistema
            {status?.cursor ? ` · actualizado ${formatDateTime(status.cursor)}` : ''}
            {status?.disponible != null ? ` · disponible ${formatCurrency(status.disponible)}${status?.disponibleAt ? ` (${formatDate(status.disponibleAt)})` : ''}` : ''}
          </p>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost finanzas-fab-btn" disabled={syncing} onClick={() => reconcile()}>
              <span className="finanzas-fab-label">Asociar ventas</span>
            </button>
            <button className="btn-ghost finanzas-fab-btn" disabled={syncing} onClick={() => releaseSync()}>
              <span className="finanzas-fab-label">Sync salidas MP</span>
            </button>
            <button className="btn-primary finanzas-fab-btn" disabled={syncing} onClick={() => doSync(false)}>
              <span className="finanzas-fab-label">{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
            </button>
          </div>
        )}
      </div>

      {data && data.resumen.length > 0 && (
        <div className="summary-cards finanzas-cards">
          {data.resumen.map((r) => (
            <div key={r.estado} className="summary-card">
              <span className="summary-card__label">{r.estado} ({r.count})</span>
              <span className="summary-card__value">{formatCurrency(r.total)}</span>
            </div>
          ))}
          <div className="summary-card summary-card--danger">
            <span className="summary-card__label">Por catalogar</span>
            <span className="summary-card__value">{formatCurrency(pendientes)}</span>
          </div>
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
        {!onlyPending && (
          <div className="filter-field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Sin catalogar</option>
              <option value="SUGERIDO">Sugerido</option>
              <option value="CONCILIADO">Conciliado</option>
              <option value="IGNORADO">Ignorado</option>
            </select>
          </div>
        )}
        <div className="filter-field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            {Object.entries(tipoLabel).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="filter-field finanzas-search">
          <label>Buscar</label>
          <input type="search" placeholder="Pagador, ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="filter-field">
          <label>&nbsp;</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={onlyPending} onChange={(e) => { setOnlyPending(e.target.checked); setPage(1); }} />
            Solo sin catalogar
          </label>
        </div>
      </div>

      {isLoading && <p className="loading-text">Cargando...</p>}
      {data && data.data.length === 0 && <p className="empty-text">Sin movimientos MP en el período.</p>}

      {data && data.data.length > 0 && (
        <div className="finanzas-list">
          {(onlyPending ? data.data.filter((m: MpAuditoriaItem) => m.estado === 'PENDIENTE' || m.estado === 'SUGERIDO') : data.data).map((m) => (
            <div key={m.id} className="finanzas-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedId(m.id)}>
              <div className="finanzas-card-main">
                <span className="finanzas-card-date">{formatDateLabel(m.fechaMp)}</span>
                <div className="finanzas-card-body">
                  <strong className="finanzas-card-desc">{m.pagador || `MP ${m.mpPaymentId}`}</strong>
                  <span className="finanzas-card-meta">
                    {tipoLabel[m.tipo] ?? m.tipo}
                    {m.vinculos.length > 0 ? ` · ${m.vinculos[0].gasto ? `${m.vinculos[0].gasto.categoria}` : `Venta ${m.vinculos[0].saleId?.slice(0, 8)}`}` : ''}
                  </span>
                </div>
              </div>
              <div className="finanzas-card-side">
                <span className={`finanzas-amount ${OUTFLOW_TIPOS.has(m.tipo) ? '' : ' in'}`}>{OUTFLOW_TIPOS.has(m.tipo) ? '-' : '+'}{formatCurrency(m.montoNeto)}</span>
                {m.fee > 0 && <span className="finanzas-card-meta">fee {formatCurrency(m.fee)}</span>}
                <span className="finanzas-card-badges">{estadoBadge(m.estado)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="finanzas-pager">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
        </div>
      )}

      {selectedId && detail && (
        <div className="modal-overlay" onClick={() => setSelectedId(null)}>
          <div className="modal-card finanzas-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.pagador || `MP ${detail.mpPaymentId}`}</h3>
            <p className="page-subtitle">
              {formatCurrency(detail.montoNeto)} neto (bruto {formatCurrency(detail.montoBruto)}{detail.fee > 0 ? `, fee ${formatCurrency(detail.fee)}` : ''})
              {' · '}{formatDateTime(detail.fechaMp)}
            </p>
            <p className="page-subtitle">ID {detail.mpPaymentId}{detail.externalRef ? ` · ref ${detail.externalRef}` : ''}{detail.email ? ` · ${detail.email}` : ''}</p>
            <div style={{ marginBottom: 12 }}>{estadoBadge(detail.estado)}</div>

            {detail.vinculos?.length > 0 && (
              <div className="settings-field">
                <label>Vínculos</label>
                {detail.vinculos.map((v, i) => (
                  <div key={i} className="finanzas-simple-row">
                    <span>{v.gasto ? `${v.gasto.descripcion} (${v.gasto.categoria})` : `Venta ${v.saleId?.slice(0, 8)}`} · {formatCurrency(v.montoAsignado)}</span>
                  </div>
                ))}
              </div>
            )}

            {(detail as { candidatos?: { id: string; orderNumber: number; total: number; paymentMethod: string; paidAt: string }[] }).candidatos?.length ? (
              <div className="settings-field">
                <label>Ventas candidatas (mismo monto ±3 días)</label>
                {(detail as { candidatos: { id: string; orderNumber: number; total: number; paymentMethod: string }[] }).candidatos.map((c) => (
                  <div key={c.id} className="finanzas-simple-row">
                    <span>Venta #{c.orderNumber} · {c.paymentMethod} · {formatCurrency(c.total)}</span>
                    {canWrite && <button className="btn-ghost" onClick={() => act(`/mp-auditoria/${detail.id}/vincular`, { saleId: c.id }, 'Vinculado a venta')}>Vincular</button>}
                  </div>
                ))}
              </div>
            ) : null}

            {canWrite && (detail.estado === 'PENDIENTE' || detail.estado === 'SUGERIDO') && (
              <>
                <div className="settings-field">
                  <label>Catalogar como gasto/ingreso</label>
                  <select value={catId} onChange={(e) => setCatId(e.target.value)}>
                    <option value="">Elegí categoría...</option>
                    {categories.filter((c) => c.active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Concepto</label>
                  <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} maxLength={120} />
                </div>
                <div className="settings-field">
                  <label>Responsable</label>
                  <select value={respId} onChange={(e) => setRespId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {responsables.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Observaciones</label>
                  <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} />
                </div>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => act(`/mp-auditoria/${detail.id}/ignorar`, {}, 'Ignorado')}>Ignorar</button>
                  <button
                    className="btn-primary"
                    disabled={!catId}
                    onClick={() => act(`/mp-auditoria/${detail.id}/categorizar`, { categoryId: catId, concepto: concepto || undefined, observaciones: observaciones || undefined, responsableId: respId || undefined }, 'Catalogado')}
                  >
                    Guardar
                  </button>
                </div>
              </>
            )}

            {canWrite && detail.estado === 'CONCILIADO' && (
              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => act(`/mp-auditoria/${detail.id}/desvincular`, {}, 'Desvinculado')}>Desvincular</button>
                <button className="btn-ghost" onClick={() => setSelectedId(null)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Eye, Loader, Megaphone, Pencil, Plus, Slash, X, XCircle } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedores, useAcreedorNotificaciones, useAcreedoresResumen, useNotificarDeudaBatch, useNotificationStatus, useSettings } from '../api/queries';
import type { Acreedor, NotifJobUpdatedEvent, NotificacionesJob, NotificationStatusMap } from '../api/types';
import { useSocketContext } from '../socket/SocketProvider';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

type SortMode = 'alpha' | 'deuda';

const getAntiguedadColor = (dias: number | null | undefined, saldo: number | undefined): string => {
  if (dias == null || !saldo) return '';
  if (dias >= 30) return 'var(--color-danger)';
  if (dias >= 15) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-success)';
};

const getNotificationIcon = (
  statusInfo: NotificationStatusMap[number],
  wsStatus: { status?: string; completedAt?: string | null; error?: string | null } | null,
) => {
  const status = wsStatus?.status ?? statusInfo?.status;
  const completedAt = wsStatus?.completedAt ?? statusInfo?.completedAt;
  const error = wsStatus?.error ?? statusInfo?.error;

  if (!status) return null;

  switch (status) {
    case 'SENT':
      return (
        <span
          title={`Enviado ${completedAt ? formatDateTime(completedAt) : ''}`}
          style={{ color: 'var(--color-success)', cursor: 'help', display: 'inline-flex' }}
        >
          <Check size={16} />
        </span>
      );
    case 'QUEUED':
      return (
        <span
          title={`En cola desde ${statusInfo?.createdAt ? formatDateTime(statusInfo.createdAt) : '--'}`}
          style={{ color: 'var(--color-warning, #f59e0b)', cursor: 'help', display: 'inline-flex' }}
        >
          <Clock size={16} />
        </span>
      );
    case 'PROCESSING':
    case 'RETRYING':
      return (
        <span
          title="Enviando..."
          style={{ color: 'var(--color-info, #3b82f6)', cursor: 'help', display: 'inline-flex' }}
        >
          <Loader size={16} className="spin-icon" />
        </span>
      );
    case 'FAILED':
      return (
        <span
          title={`Falló: ${error || 'Error desconocido'}`}
          style={{ color: 'var(--color-danger)', cursor: 'help', display: 'inline-flex' }}
        >
          <XCircle size={16} />
        </span>
      );
    case 'CANCELLED':
      return (
        <span
          title="Cancelado"
          style={{ color: 'var(--color-text-faint)', cursor: 'help', display: 'inline-flex' }}
        >
          <Slash size={16} />
        </span>
      );
    default:
      return null;
  }
};

export const AdminAcreedoresPage: React.FC = () => {
  const { data: acreedores = [], isLoading } = useAcreedores();
  const { data: resumen } = useAcreedoresResumen();
  const { data: settings } = useSettings();
  const batchMutation = useNotificarDeudaBatch();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { socket } = useSocketContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', notas: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchSending, setBatchSending] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [wsJobStatus, setWsJobStatus] = useState<Record<number, { status: string; completedAt?: string | null; error?: string | null }>>({});
  const [historyModalAcreedor, setHistoryModalAcreedor] = useState<number | null>(null);

  const acreedorIds = useMemo(() => acreedores.map((a) => a.id), [acreedores]);
  const { data: notificationStatus } = useNotificationStatus(
    activeBatchId ? [] : acreedorIds,
  );

  const batchStatusRef = useRef(activeBatchId);
  batchStatusRef.current = activeBatchId;

  useEffect(() => {
    if (!socket || !activeBatchId) return;

    socket.emit('notification-batch.subscribe', { batchId: activeBatchId });

    const handler = (payload: NotifJobUpdatedEvent) => {
      if (payload.batchId !== activeBatchId) return;
      setWsJobStatus((prev) => ({
        ...prev,
        [payload.acreedorId]: {
          status: payload.status,
          completedAt: payload.completedAt,
          error: payload.error,
        },
      }));
    };

    socket.on('notification.job_updated', handler);

    return () => {
      socket.off('notification.job_updated', handler);
      const id = batchStatusRef.current;
      if (id) {
        fetchBatchStatus(id);
      }
    };
  }, [socket, activeBatchId]);

  const fetchBatchStatus = useCallback(async (batchId: string) => {
    try {
      const res = await apiClient.get(`/acreedores/batch/${batchId}/status`);
      const data = res.data;
      if (!data.isRunning) {
        setActiveBatchId(null);
        setWsJobStatus({});
        pushToast(`Lote completado: ${data.sent} enviados, ${data.failed} fallidos`, data.failed > 0 ? 'error' : 'success');
        await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
        await queryClient.invalidateQueries({ queryKey: ['notificaciones-queue'] });
      }
    } catch {
      setActiveBatchId(null);
    }
  }, [pushToast, queryClient]);

  const filtered = useMemo(() => {
    let list = [...acreedores];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.nombre.toLowerCase().includes(q));
    }
    if (sortMode === 'deuda') {
      list.sort((a, b) => (b.saldo ?? 0) - (a.saldo ?? 0));
    } else {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return list;
  }, [acreedores, search, sortMode]);

  const notificationsEnabled = settings?.enableNotificationsModule ?? false;

  const toggleSelectAll = () => {
    const allEligibleIds = filtered
      .filter((a) => notificationsEnabled && a.telefono && (a.saldo ?? 0) > 0)
      .map((a) => a.id);
    if (allEligibleIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allEligibleIds));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedWithPhone = useMemo(
    () => filtered.filter((a) => selectedIds.has(a.id) && a.telefono && (a.saldo ?? 0) > 0).length,
    [filtered, selectedIds],
  );

  const handleBatchSend = async () => {
    const ids = Array.from(selectedIds);
    setBatchSending(true);
    setError(null);
    try {
      const result = await batchMutation.mutateAsync({ acreedorIds: ids });
      setActiveBatchId(result.batchId);
      setSelectedIds(new Set());
      pushToast(`${result.enviables} notificaciones encoladas`, 'success');
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setBatchSending(false);
    }
  };

  const resetForm = () => {
    setForm({ nombre: '', telefono: '', notas: '', activo: true });
    setEditingId(null);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const a = acreedores.find((ac) => ac.id === id);
    if (!a) return;
    setForm({ nombre: a.nombre, telefono: a.telefono ?? '', notas: a.notas ?? '', activo: a.activo });
    setEditingId(id);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiClient.patch(`/acreedores/${editingId}`, {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          notas: form.notas || undefined,
        });
        const acreedor = acreedores.find((a) => a.id === editingId);
        if (acreedor && acreedor.activo !== form.activo) {
          await apiClient.patch(`/acreedores/${editingId}/toggle`);
        }
        pushToast('Acreedor actualizado', 'success');
      } else {
        await apiClient.post('/acreedores', {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          notas: form.notas || undefined,
        });
        pushToast('Acreedor creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores-resumen'] });
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const getSaldoDisplay = (a: Acreedor) => {
    const s = a.saldo ?? 0;
    const sf = a.saldoFavor ?? 0;
    if (sf > 0) {
      return <span className="success-text" style={{ fontWeight: 600 }}>{`A favor: ${formatCurrency(sf)}`}</span>;
    }
    if (s > 0 && a.alertaDeuda) {
      return <span className="error-text" style={{ fontWeight: 600 }}>{formatCurrency(s)}</span>;
    }
    if (s > 0) {
      return <span className="warning-text">{formatCurrency(s)}</span>;
    }
    return <span style={{ color: 'var(--color-text-muted)' }}>$0</span>;
  };

  const getAntiguedadDisplay = (a: Acreedor) => {
    const s = a.saldo ?? 0;
    if (s <= 0) return '--';
    return `${a.diasSinPagar ?? 0}d`;
  };

  const allEligibleCount = useMemo(
    () => filtered.filter((a) => notificationsEnabled && a.telefono && (a.saldo ?? 0) > 0).length,
    [filtered, notificationsEnabled],
  );

  const allSelected = allEligibleCount > 0 && filtered
    .filter((a) => notificationsEnabled && a.telefono && (a.saldo ?? 0) > 0)
    .every((a) => selectedIds.has(a.id));

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Acreedores</h2>
            <p className="page-header-subtitle">Control de ventas fiadas y pagos de acreedores.</p>
          </div>
        </div>
      </div>

      {resumen && (
        <div className="sales-kpis">
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Deuda total</span>
            <span className="sales-kpi-value">{formatCurrency(resumen.deudaTotal)}</span>
          </div>
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Acreedores con deuda</span>
            <span className="sales-kpi-value">{resumen.acreedoresConDeuda}</span>
          </div>
          {resumen.creditoTotal > 0 && (
            <div className="sales-kpi-card">
              <span className="sales-kpi-label">Crédito a favor</span>
              <span className="sales-kpi-value success-text">{formatCurrency(resumen.creditoTotal)}</span>
            </div>
          )}
          {resumen.acreedoresConCredito > 0 && (
            <div className="sales-kpi-card">
              <span className="sales-kpi-label">Con crédito a favor</span>
              <span className="sales-kpi-value">{resumen.acreedoresConCredito}</span>
            </div>
          )}
        </div>
      )}

      <div className="stock-toolbar">
        <input
          type="text"
          className="stock-search-input"
          placeholder="Buscar acreedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sort-segmented">
          <button
            type="button"
            className={`sort-segment ${sortMode === 'alpha' ? 'sort-segment--active' : ''}`}
            onClick={() => setSortMode('alpha')}
          >
            ABC
          </button>
          <button
            type="button"
            className={`sort-segment ${sortMode === 'deuda' ? 'sort-segment--active' : ''}`}
            onClick={() => setSortMode('deuda')}
          >
            $$$
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>
            {search ? 'Sin resultados para la búsqueda.' : 'No hay acreedores registrados.'}
          </p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              {notificationsEnabled && (
                <span className="col-action" style={{ flex: '0 0 36px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Seleccionar todos con deuda y teléfono"
                  />
                </span>
              )}
              <span className="col-date">Nombre</span>
              <span className="col-user">Teléfono</span>
              <span className="col-total" style={{ flex: '0 0 110px' }}>Saldo</span>
              <span className="col-total" style={{ flex: '0 0 90px' }}>Antigüedad</span>
              <span className="col-method" style={{ flex: '0 0 70px' }}>Estado</span>
              <span className="col-action" style={{ flex: '0 0 130px' }}></span>
            </div>
            {filtered.map((a) => {
              const isEligible = notificationsEnabled && a.telefono && (a.saldo ?? 0) > 0;
              const wsInfo = wsJobStatus[a.id] || null;
              const statusInfo = notificationStatus?.[a.id] ?? null;
              const notifIcon = getNotificationIcon(statusInfo, wsInfo);

              return (
                <div
                  key={a.id}
                  className="sales-table-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/acreedores/${a.id}`)}
                >
                  {notificationsEnabled && (
                    <span
                      className="col-action"
                      style={{ flex: '0 0 36px' }}
                      onClick={(e) => {
                        if (isEligible) {
                          e.stopPropagation();
                          toggleSelect(a.id);
                        }
                      }}
                    >
                      {isEligible && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </span>
                  )}
                  <span className="col-date" style={{ fontWeight: 500 }}>{a.nombre}</span>
                  <span className="col-user">{a.telefono || '--'}</span>
                  <span className="col-total" style={{ flex: '0 0 110px' }}>{getSaldoDisplay(a)}</span>
                  <span
                    className="col-total"
                    style={{
                      flex: '0 0 90px',
                      color: getAntiguedadColor(a.diasSinPagar, a.saldo),
                      fontWeight: 500,
                    }}
                  >
                    {getAntiguedadDisplay(a)}
                  </span>
                  <span className="col-method" style={{ flex: '0 0 70px' }}>
                    {a.activo ? (
                      <span className="badge badge-success">Activo</span>
                    ) : (
                      <span className="badge badge-neutral">Inactivo</span>
                    )}
                  </span>
                  <span className="col-action" style={{ flex: '0 0 130px', display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {notifIcon && <span style={{ marginRight: '0.25rem' }}>{notifIcon}</span>}
                    {notificationsEnabled && a.telefono && (a.saldo ?? 0) > 0 && (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setHistoryModalAcreedor(a.id); }}
                        title="Ver notificaciones enviadas"
                      >
                        <Megaphone size={16} />
                      </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/admin/acreedores/${a.id}`); }} title="Ver">{<Eye size={16} />}</button>
                    <button type="button" className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(a.id); }} title="Editar">{<Pencil size={16} />}</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        className="fab-button-v2"
        onClick={openCreate}
        aria-label="Nuevo acreedor"
        title="Nuevo acreedor"
      >
        <Plus size={24} />
      </button>

      {notificationsEnabled && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-count">
            {selectedIds.size} seleccionados · {selectedWithPhone} con notificación
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setSelectedIds(new Set())}>
              Limpiar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleBatchSend}
              disabled={selectedWithPhone === 0 || batchSending}
            >
              {batchSending ? 'Encolando...' : `Enviar notificaciones (${selectedWithPhone})`}
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar acreedor' : 'Nuevo acreedor'}</h3>
              <button className="icon-button" onClick={() => { setModalOpen(false); resetForm(); }}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              <div className="settings-field">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del acreedor"
                />
              </div>
              <div className="settings-field">
                <label>Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Teléfono"
                />
              </div>
              <div className="settings-field">
                <label>Notas</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Notas adicionales"
                />
              </div>
              {editingId && (
                <div className="settings-field">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    <span className="toggle-switch-track" />
                    Activo
                  </label>
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyModalAcreedor !== null && (
        <AcreedorNotificacionesModal acreedorId={historyModalAcreedor} onClose={() => setHistoryModalAcreedor(null)} />
      )}
    </div>
  );
};

const AcreedorNotificacionesModal: React.FC<{ acreedorId: number; onClose: () => void }> = ({ acreedorId, onClose }) => {
  const { data: notificaciones = [], isLoading } = useAcreedorNotificaciones(acreedorId);

  const getNotifBadge = (status: string) => {
    switch (status) {
      case 'SENT': return <span className="badge badge-success">Enviado</span>;
      case 'FAILED': return <span className="badge badge-error">Falló</span>;
      case 'QUEUED': return <span className="badge badge-warning">En cola</span>;
      case 'PROCESSING': return <span className="badge badge-info">Enviando...</span>;
      case 'RETRYING': return <span className="badge badge-warning">Reintentando</span>;
      case 'CANCELLED': return <span className="badge badge-neutral">Cancelado</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h3>Historial de notificaciones</h3>
          <button className="icon-button" onClick={onClose}>{<X size={16} />}</button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" aria-hidden="true" />
            </div>
          ) : notificaciones.length === 0 ? (
            <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
              No hay notificaciones registradas para este acreedor.
            </p>
          ) : (
            <div className="sales-table">
              <div className="sales-table-head">
                <span className="col-date">Fecha</span>
                <span className="col-method">Canal</span>
                <span className="col-total" style={{ flex: '0 0 110px' }}>Estado</span>
                <span className="col-user">Detalle</span>
              </div>
              {notificaciones.map((job: NotificacionesJob) => (
                <div key={job.id} className="sales-table-row" style={{ cursor: 'default' }}>
                  <span className="col-date">{job.createdAt ? formatDateTime(job.createdAt) : '--'}</span>
                  <span className="col-method">
                    {job.channel || 'WhatsApp'}
                    {job.attempts > 1 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginLeft: '0.35rem' }}>
                        (×{job.attempts})
                      </span>
                    )}
                  </span>
                  <span className="col-total" style={{ flex: '0 0 110px' }}>{getNotifBadge(job.status)}</span>
                  <span className="col-user" style={{ fontSize: '0.85rem' }}>
                    {job.error ? (
                      <span style={{ color: 'var(--color-danger)' }} title={job.error}>
                        {job.error.length > 50 ? job.error.slice(0, 50) + '...' : job.error}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-faint)' }}>--</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

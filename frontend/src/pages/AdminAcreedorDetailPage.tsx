import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Send, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedor, useAcreedorDeuda, useAcreedorNotificaciones, useSettings, useTreasuryAccounts, useMoneyAccounts } from '../api/queries';
import type { FiadoVentaItem, AjusteAcreedorItem, PagoAcreedorItem, NotificacionesJob, Sale } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { buildWhatsAppWebLink } from '../utils/whatsappLink';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const getPaymentMethodLabel = (method?: string) => {
  if (method === 'MP_QR') return 'QR';
  if (method === 'TRANSFER') return 'Transf.';
  if (method === 'FIADO') return 'Fiado';
  return 'Efectivo';
};

const getMedioPagoLabel = (medio: string) =>
  medio === 'transferencia' ? 'Transferencia' : 'Efectivo';

const getNotifStatusDisplay = (job: NotificacionesJob) => {
  const { status } = job;
  switch (status) {
    case 'SENT':
      return <span className="badge badge-success">Enviado</span>;
    case 'FAILED':
      return <span className="badge badge-error">Falló</span>;
    case 'QUEUED':
      return <span className="badge badge-warning">En cola</span>;
    case 'PROCESSING':
      return <span className="badge badge-info">Enviando...</span>;
    case 'RETRYING':
      return <span className="badge badge-warning">Reintentando</span>;
    case 'CANCELLED':
      return <span className="badge badge-neutral">Cancelado</span>;
    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
};

const AcreedorNotificaciones: React.FC<{ acreedorId: number }> = ({ acreedorId }) => {
  const { data: notificaciones = [], isLoading } = useAcreedorNotificaciones(acreedorId);

  if (isLoading) {
    return (
      <div className="settings-section" style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div className="spinner" aria-hidden="true" />
      </div>
    );
  }

  if (notificaciones.length === 0) {
    return null;
  }

  return (
    <div className="settings-section" style={{ marginTop: '1.5rem' }}>
      <h3 className="settings-section-header">Notificaciones</h3>
      <div className="sales-table">
        <div className="sales-table-head">
          <span className="col-date">Fecha</span>
          <span className="col-method" style={{ whiteSpace: 'nowrap', flex: 2 }}>Tipo</span>
          <span className="col-method" style={{ flex: '0 0 120px' }}>Estado</span>
          <span className="col-user">Detalle</span>
        </div>
        {notificaciones.map((job) => (
          <div key={job.id} className="sales-table-row" style={{ cursor: 'default' }}>
            <span className="col-date">{job.createdAt ? formatDateTime(job.createdAt) : '--'}</span>
            <span className="col-method" style={{ whiteSpace: 'nowrap', flex: 2 }}>
              {job.channel || 'WhatsApp'}
              {job.attempts > 1 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginLeft: '0.35rem' }}>
                  (intento {job.attempts})
                </span>
              )}
            </span>
            <span className="col-method" style={{ flex: '0 0 120px' }}>{getNotifStatusDisplay(job)}</span>
            <span className="col-user" style={{ fontSize: '0.85rem' }}>
              {job.error ? (
                <span style={{ color: 'var(--color-danger)' }} title={job.error}>
                  {job.error.length > 50 ? job.error.slice(0, 50) + '...' : job.error}
                </span>
              ) : job.status === 'SENT' && job.completedAt ? (
                <span style={{ color: 'var(--color-text-faint)' }}>{formatDate(job.completedAt)}</span>
              ) : (
                <span style={{ color: 'var(--color-text-faint)' }}>--</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminAcreedorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const acreedorId = id ? Number(id) : undefined;
  const { data: acreedor } = useAcreedor(acreedorId);
  const { data: deuda, isLoading: deudaLoading } = useAcreedorDeuda(acreedorId);
  const { data: treasuryAccounts = [] } = useTreasuryAccounts();
  const { data: moneyAccounts = [] } = useMoneyAccounts();
  const { data: settings } = useSettings();
  const notificationsEnabled = settings?.enableNotificationsModule ?? false;
  const whatsappUseApi = settings?.whatsappUseApi !== false;
  const clubName = settings?.clubName || settings?.storeName || null;
  const autoTreasuryId = treasuryAccounts.length === 1 ? treasuryAccounts[0].id : '';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [pagoModal, setPagoModal] = useState(false);
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    notas: '',
    treasuryAccountId: autoTreasuryId,
    medioPago: 'efectivo',
    moneyAccountId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleLoading, setSaleLoading] = useState(false);

  const [ajusteModal, setAjusteModal] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
  });

  type HistoryEntry =
    | { kind: 'venta'; data: FiadoVentaItem; date: string; monto: number }
    | { kind: 'ajuste'; data: AjusteAcreedorItem; date: string; monto: number }
    | { kind: 'pago'; data: PagoAcreedorItem; date: string; monto: number };

  const history = useMemo<HistoryEntry[]>(() => {
    if (!deuda) return [];
    const entries: HistoryEntry[] = [
      ...deuda.fiadoVentas.map((fv) => ({
        kind: 'venta' as const,
        data: fv,
        date: fv.createdAt,
        monto: Number(fv.monto),
      })),
      ...(deuda.ajustes || []).map((a) => ({
        kind: 'ajuste' as const,
        data: a,
        date: a.fecha,
        monto: a.monto,
      })),
      ...deuda.pagos.map((p) => ({
        kind: 'pago' as const,
        data: p,
        date: p.fecha,
        monto: -Number(p.monto),
      })),
    ];
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [deuda]);

  const handlePagoSave = async () => {
    const monto = Number(pagoForm.monto);
    if (!monto || monto <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!pagoForm.treasuryAccountId) {
      setError('Selecciona dónde ingresó el dinero');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/acreedores/${acreedorId}/pagos`, {
        monto,
        fecha: pagoForm.fecha,
        notas: pagoForm.notas || undefined,
        treasuryAccountId: pagoForm.treasuryAccountId,
        medioPago: pagoForm.medioPago,
        moneyAccountId: pagoForm.moneyAccountId || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['acreedor-deuda', acreedorId] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores-resumen'] });
      await queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['finanzas-movements'] });
      pushToast('Pago registrado', 'success');
      setPagoModal(false);
      setPagoForm({
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        notas: '',
        treasuryAccountId: autoTreasuryId,
        medioPago: 'efectivo',
        moneyAccountId: '',
      });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAjusteSave = async () => {
    const monto = Number(ajusteForm.monto);
    if (!monto || monto <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/acreedores/${acreedorId}/ajustes`, {
        monto,
        fecha: ajusteForm.fecha,
        descripcion: ajusteForm.descripcion || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['acreedor-deuda', acreedorId] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores-resumen'] });
      pushToast('Deuda agregada', 'success');
      setAjusteModal(false);
      setAjusteForm({
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: '',
      });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSaleDetail = async (saleId: string) => {
    setSelectedSaleId(saleId);
    setSaleLoading(true);
    try {
      const response = await apiClient.get<Sale>(`/sales/${saleId}`);
      setSelectedSale(response.data);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
      setSelectedSaleId(null);
    } finally {
      setSaleLoading(false);
    }
  };

  if (!acreedor) {
    return (
      <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div className="spinner" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/admin/acreedores')}
              style={{ marginBottom: '0.5rem' }}
            >
              <ArrowLeft size={16} /> Volver
            </button>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>{acreedor.nombre}</h2>
            <p className="page-header-subtitle">
              {acreedor.telefono && <span>Telefono: {acreedor.telefono} · </span>}
              <span className={acreedor.activo ? 'badge badge-success' : 'badge badge-neutral'}>
                {acreedor.activo ? 'Activo' : 'Inactivo'}
              </span>
            </p>
            {acreedor.notas && <p className="page-header-subtitle" style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>{acreedor.notas}</p>}
          </div>
          {notificationsEnabled && !whatsappUseApi && acreedor.telefono && (deuda?.saldoPendiente ?? 0) > 0 && (
            <a
              href={buildWhatsAppWebLink({
                nombre: acreedor.nombre,
                telefono: acreedor.telefono,
                saldo: deuda?.saldoPendiente,
                diasSinPagar: deuda?.diasSinPagar,
                template: settings?.whatsappWebMessage,
                club: clubName,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Send size={16} /> Enviar notificación
            </a>
          )}
        </div>
      </div>

      {deuda?.alertaDeuda && (
        <div className="alerta-deuda-banner">
          <AlertTriangle size={16} className="alerta-deuda-icon" /> Deuda pendiente desde hace {deuda.diasSinPagar} dias.
          {deuda.deudaMasAntigua && (
            <> Ultima venta sin saldar: {formatDate(deuda.deudaMasAntigua)}.</>
          )}
        </div>
      )}

      {deuda?.estadoDeuda === 'LIMITE' && (
        <div className="alerta-deuda-banner" style={{ borderColor: 'var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
          <AlertTriangle size={16} className="alerta-deuda-icon" /> Deuda por encima del límite
          {deuda.limiteDeuda != null && <> ({formatCurrency(deuda.limiteDeuda)})</>}. No se pueden registrar nuevas ventas fiadas ni ajustes.
        </div>
      )}

      {deuda?.estadoDeuda === 'ADVERTENCIA' && (
        <div className="alerta-deuda-banner" style={{ borderColor: 'var(--color-warning, #f59e0b)', background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent)' }}>
          <AlertTriangle size={16} className="alerta-deuda-icon" /> Deuda por encima de la advertencia
          {deuda.advertenciaDeuda != null && <> ({formatCurrency(deuda.advertenciaDeuda)})</>}.
        </div>
      )}

      {deuda && (
        <div className="sales-kpis" style={{ marginBottom: '1.5rem' }}>
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Total fiado</span>
            <span className="sales-kpi-value">{formatCurrency(deuda.totalFiado)}</span>
          </div>
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Total pagado</span>
            <span className="sales-kpi-value">{formatCurrency(deuda.totalPagado)}</span>
          </div>
          {(deuda.advertenciaDeuda != null || deuda.limiteDeuda != null) && (
            <div className="sales-kpi-card">
              <span className="sales-kpi-label">Advertencia / Límite</span>
              <span className="sales-kpi-value" style={{ fontSize: '1.05rem' }}>
                {deuda.advertenciaDeuda != null ? formatCurrency(deuda.advertenciaDeuda) : '—'}
                {' / '}
                {deuda.limiteDeuda != null ? formatCurrency(deuda.limiteDeuda) : '—'}
              </span>
            </div>
          )}
          {deuda.saldoFavor > 0 ? (
            <div className="sales-kpi-card">
              <span className="sales-kpi-label">Saldo a favor</span>
              <span className="sales-kpi-value success-text">
                {formatCurrency(deuda.saldoFavor)}
              </span>
            </div>
          ) : (
            <div className="sales-kpi-card">
              <span className="sales-kpi-label">Saldo pendiente</span>
              <span className={`sales-kpi-value ${deuda.saldoPendiente > 0 ? 'warning-text' : 'success-text'}`}>
                {formatCurrency(deuda.saldoPendiente)}
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '0.5rem' }}>
        <button type="button" className="btn-ghost" onClick={() => { setError(null); setAjusteModal(true); }}>
          + Agregar a deuda
        </button>
        <button type="button" className="btn-primary" onClick={() => { setError(null); setPagoForm(prev => ({ ...prev, treasuryAccountId: autoTreasuryId })); setPagoModal(true); }}>
          + Registrar pago
        </button>
      </div>

      {deudaLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
        </div>
      ) : !deuda ? (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center' }}>Sin datos de deuda.</p>
      ) : (
        <>
          <div className="settings-section">
            <h3 className="settings-section-header">Historial</h3>
            {history.length === 0 ? (
              <p style={{ color: 'var(--color-text-faint)' }}>Sin movimientos registrados.</p>
            ) : (
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Fecha</span>
                  <span className="col-total" style={{ flex: '0 0 140px' }}>Monto</span>
                  <span className="col-method" style={{ whiteSpace: 'nowrap' }}>Concepto</span>
                  <span className="col-user">Detalle</span>
                </div>
                {history.map((entry, i) => {
                  const isPayment = entry.kind === 'pago';
                  const dateStr = formatDate(entry.date);
                  const amountDisplay = isPayment
                    ? `-${formatCurrency(Math.abs(entry.monto))}`
                    : formatCurrency(entry.monto);

                  let concepto: string;
                  let detalle: string;
                  if (entry.kind === 'venta') {
                    concepto = 'Venta fiada';
                    detalle = `Venta #${entry.data.ventaId.slice(0, 8)}`;
                  } else if (entry.kind === 'ajuste') {
                    concepto = 'Ajuste';
                    detalle = entry.data.descripcion || '--';
                  } else {
                    concepto = getMedioPagoLabel(entry.data.medioPago);
                    detalle = entry.data.notas || '--';
                  }

                  return (
                    <div
                      key={`${entry.kind}-${i}`}
                      className="sales-table-row"
                      style={{ cursor: entry.kind === 'venta' ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (entry.kind === 'venta') {
                          handleOpenSaleDetail(entry.data.ventaId);
                        }
                      }}
                    >
                      <span className="col-date">{dateStr}</span>
                      <span
                        className="col-total"
                        style={{
                          flex: '0 0 140px',
                          fontWeight: 500,
                          color: isPayment ? 'var(--color-success)' : 'var(--color-warning, #f59e0b)',
                        }}
                      >
                        {amountDisplay}
                      </span>
                      <span className="col-method" style={{ whiteSpace: 'nowrap', paddingLeft: '1.5rem' }}>{concepto}</span>
                      <span className="col-user" style={{ paddingLeft: '1.5rem' }}>
                        {detalle}
                        {entry.kind === 'venta' && (
                          <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            (Ver detalle)
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {notificationsEnabled && (
        <AcreedorNotificaciones acreedorId={acreedorId!} />
      )}

      {pagoModal && (
        <div className="modal-backdrop" onClick={() => setPagoModal(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar pago</h3>
              <button className="icon-button" onClick={() => setPagoModal(false)}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              <div className="settings-field">
                <label>Monto *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="settings-field">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>¿Dónde ingresó el dinero? *</label>
                <select
                  value={pagoForm.treasuryAccountId}
                  onChange={(e) => setPagoForm({ ...pagoForm, treasuryAccountId: e.target.value })}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <label>Medio de pago (caja simple) *</label>
                <div className="finanzas-chips">
                  <button
                    type="button"
                    className={pagoForm.medioPago === 'efectivo' ? 'chip active' : 'chip'}
                    onClick={() => setPagoForm({ ...pagoForm, medioPago: 'efectivo', moneyAccountId: '' })}
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    className={pagoForm.medioPago === 'transferencia' ? 'chip active' : 'chip'}
                    onClick={() => setPagoForm({ ...pagoForm, medioPago: 'transferencia', moneyAccountId: '' })}
                  >
                    Mercado Pago
                  </button>
                </div>
              </div>
              {moneyAccounts.length > 2 && (
                <div className="settings-field">
                  <label>Cuenta de caja</label>
                  <select
                    value={pagoForm.moneyAccountId}
                    onChange={(e) => setPagoForm({ ...pagoForm, moneyAccountId: e.target.value })}
                  >
                    <option value="">Automática según medio de pago</option>
                    {moneyAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="settings-field">
                <label>Notas</label>
                <textarea
                  rows={2}
                  value={pagoForm.notas}
                  onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                  placeholder="Notas adicionales"
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setPagoModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handlePagoSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ajusteModal && (
        <div className="modal-backdrop" onClick={() => setAjusteModal(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar a deuda</h3>
              <button className="icon-button" onClick={() => setAjusteModal(false)}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              <div className="settings-field">
                <label>Monto *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ajusteForm.monto}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, monto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="settings-field">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={ajusteForm.fecha}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, fecha: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Descripción</label>
                <textarea
                  rows={2}
                  value={ajusteForm.descripcion}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, descripcion: e.target.value })}
                  placeholder="Descripción del ajuste"
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setAjusteModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleAjusteSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSaleId && (
        <div className="modal-backdrop" onClick={() => { setSelectedSaleId(null); setSelectedSale(null); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle de venta</h3>
              <button className="icon-button" onClick={() => { setSelectedSaleId(null); setSelectedSale(null); }}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {saleLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" aria-hidden="true" />
                </div>
              ) : selectedSale ? (
                <>
                  <div className="sales-detail-row">
                    <span>Fecha</span>
                    <span>{formatDate(selectedSale.createdAt)} {new Date(selectedSale.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  </div>
                  <div className="sales-detail-row">
                    <span>Total</span>
                    <strong>{formatCurrency(selectedSale.total)}</strong>
                  </div>
                  <div className="sales-detail-row">
                    <span>Medio de pago</span>
                    <span>{getPaymentMethodLabel(selectedSale.paymentMethod)}</span>
                  </div>
                  <div className="sales-detail-products">
                    {selectedSale.items.map((item) => (
                      <div key={item.id} className="sales-detail-product">
                        {item.quantity} x {item.product.name} <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  {selectedSale.vouchers && selectedSale.vouchers.length > 0 && (
                    <>
                      <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.75rem 0' }} />
                      <div className="sales-detail-row">
                        <span>Vouchers WiFi</span>
                      </div>
                      {selectedSale.vouchers.map((v) => (
                        <div key={v.id} className="sales-detail-row" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '2px' }}>
                          <span>{v.plan?.name}</span>
                          <span>{v.pin}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className="btn-ghost" onClick={() => { setSelectedSaleId(null); setSelectedSale(null); }}>
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--color-text-faint)', textAlign: 'center' }}>No se pudo cargar la venta.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

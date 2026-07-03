import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedor, useAcreedorDeuda, useTreasuryAccounts } from '../api/queries';
import type { FiadoVentaItem, AjusteAcreedorItem, PagoAcreedorItem } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });

const getMedioPagoLabel = (medio: string) =>
  medio === 'transferencia' ? 'Transferencia' : 'Efectivo';

export const AdminAcreedorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const acreedorId = id ? Number(id) : undefined;
  const { data: acreedor } = useAcreedor(acreedorId);
  const { data: deuda, isLoading: deudaLoading } = useAcreedorDeuda(acreedorId);
  const { data: treasuryAccounts = [] } = useTreasuryAccounts();
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      await queryClient.invalidateQueries({ queryKey: ['acreedor-deuda', acreedorId] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores-resumen'] });
      pushToast('Pago registrado', 'success');
      setPagoModal(false);
      setPagoForm({
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        notas: '',
        treasuryAccountId: autoTreasuryId,
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
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Saldo pendiente</span>
            <span className={`sales-kpi-value ${deuda.saldoPendiente > 0 ? 'warning-text' : 'success-text'}`}>
              {formatCurrency(deuda.saldoPendiente)}
            </span>
          </div>
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
                  <span className="col-method">Concepto</span>
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
                    <div key={`${entry.kind}-${i}`} className="sales-table-row">
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
                      <span className="col-method">{concepto}</span>
                      <span className="col-user">{detalle}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
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
    </div>
  );
};

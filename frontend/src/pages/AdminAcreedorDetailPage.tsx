import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedor, useAcreedorDeuda, useTreasuryAccounts } from '../api/queries';
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
    medioPago: 'efectivo' as 'efectivo' | 'transferencia',
    fecha: new Date().toISOString().slice(0, 10),
    notas: '',
    treasuryAccountId: autoTreasuryId,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        medioPago: pagoForm.medioPago,
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
        medioPago: 'efectivo',
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
              ← Volver
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
          ⚠ Deuda pendiente desde hace {deuda.diasSinPagar} dias.
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
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
          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h3 className="settings-section-header">Ventas fiadas</h3>
            {deuda.fiadoVentas.length === 0 ? (
              <p style={{ color: 'var(--color-text-faint)' }}>No hay ventas fiadas registradas.</p>
            ) : (
              <div className="fiado-ventas-table">
                <div className="fiado-ventas-table-head">
                  <span className="fv-col-fecha">Fecha</span>
                  <span className="fv-col-monto">Monto</span>
                  <span className="fv-col-saldo">Saldo</span>
                </div>
                {deuda.fiadoVentas.map((fv) => (
                  <div
                    key={fv.id}
                    className={`fiado-ventas-table-row ${fv.saldoRestante !== undefined && fv.saldoRestante > 0 ? 'row-pending-debt' : ''}`}
                  >
                    <span className="fv-col-fecha">{formatDate(fv.createdAt)}</span>
                    <span className="fv-col-monto">{formatCurrency(Number(fv.monto))}</span>
                    <span className={`fv-col-saldo ${fv.saldoRestante !== undefined && fv.saldoRestante > 0 ? 'fv-saldo-pendiente' : ''}`}>
                      {fv.saldoRestante !== undefined
                        ? fv.saldoRestante > 0
                          ? formatCurrency(fv.saldoRestante)
                          : <span style={{ color: 'var(--color-text-muted)' }}>$0</span>
                        : '--'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-header">Pagos realizados</h3>
            {deuda.pagos.length === 0 ? (
              <p style={{ color: 'var(--color-text-faint)' }}>No hay pagos registrados.</p>
            ) : (
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Fecha</span>
                  <span className="col-total">Monto</span>
                  <span className="col-method">Medio de pago</span>
                  <span className="col-user">Notas</span>
                </div>
                {deuda.pagos.map((p) => (
                  <div key={p.id} className="sales-table-row">
                    <span className="col-date">{formatDate(p.fecha)}</span>
                    <span className="col-total" style={{ color: 'var(--color-success)', fontWeight: 500 }}>-{formatCurrency(Number(p.monto))}</span>
                    <span className="col-method">{getMedioPagoLabel(p.medioPago)}</span>
                    <span className="col-user">{p.notas || '--'}</span>
                  </div>
                ))}
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
              <button className="icon-button" onClick={() => setPagoModal(false)}>✕</button>
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
                <label>Medio de pago *</label>
                <select
                  value={pagoForm.medioPago}
                  onChange={(e) => setPagoForm({ ...pagoForm, medioPago: e.target.value as 'efectivo' | 'transferencia' })}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
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
    </div>
  );
};

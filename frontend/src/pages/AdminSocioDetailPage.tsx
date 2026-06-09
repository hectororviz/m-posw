import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSocio, useSocioCuotas } from '../api/queries';
import type { SocioCuotaItem } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const estadoBadge = (estado: string) => {
  if (estado === 'ACTIVO') return <span className="badge badge-success">Activo</span>;
  if (estado === 'SUSPENDIDO') return <span className="badge badge-warning">Suspendido</span>;
  return <span className="badge badge-neutral">Inactivo</span>;
};

const cuotaEstadoBadge = (estado: string) => {
  if (estado === 'PAGADO') return <span className="badge badge-success">Pagado</span>;
  if (estado === 'PARCIAL') return <span className="badge badge-warning">Parcial</span>;
  return <span className="badge badge-danger">Pendiente</span>;
};

export const AdminSocioDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const socioId = id ? Number(id) : undefined;
  const { data: socio } = useSocio(socioId);
  const { data: cuotas = [], isLoading: cuotasLoading } = useSocioCuotas(socioId);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [pagoModal, setPagoModal] = useState(false);
  const [pagoCuotaId, setPagoCuotaId] = useState<number | null>(null);
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    observacion: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPagoModal = (cuota: SocioCuotaItem) => {
    setPagoCuotaId(cuota.id);
    const pendiente = Number(cuota.montoOriginal) - Number(cuota.montoPagado);
    setPagoForm({
      monto: String(pendiente),
      fecha: new Date().toISOString().slice(0, 10),
      observacion: '',
    });
    setError(null);
    setPagoModal(true);
  };

  const handlePagoSave = async () => {
    const monto = Number(pagoForm.monto);
    if (!monto || monto <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!pagoCuotaId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/socios/cuotas/${pagoCuotaId}/pagar`, {
        monto,
        fecha: pagoForm.fecha,
        observacion: pagoForm.observacion || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['socio-cuotas', socioId] });
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
      await queryClient.invalidateQueries({ queryKey: ['socios-tesoreria-resumen'] });
      pushToast('Pago registrado', 'success');
      setPagoModal(false);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCarnet = () => {
    const token = localStorage.getItem('authToken');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    window.open(`${baseUrl}/socios/${socioId}/carnet?token=${token}`, '_blank');
  };

  if (!socio) {
    return (
      <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div className="spinner" aria-hidden="true" />
      </div>
    );
  }

  const deudaTotal = cuotas
    .filter((c) => c.estado !== 'PAGADO')
    .reduce((sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)), 0);

  const fechaAlta = new Date(socio.fechaAlta);
  const mesAlta = MONTH_NAMES[fechaAlta.getUTCMonth()];
  const anioAlta = fechaAlta.getUTCFullYear();

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/admin/socios')}
              style={{ marginBottom: '0.5rem' }}
            >
              ← Volver
            </button>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>
              {socio.apellido}, {socio.nombre}
            </h2>
            <p className="page-header-subtitle">
              Nº Socio: #{socio.nroSocio} · {socio.socioTipo?.nombre || '--'} · {estadoBadge(socio.estado)}
              {' · '}Miembro desde {mesAlta} {anioAlta}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate(`/admin/socios/${socio.id}/editar`)}
            >
              Editar
            </button>
            <button type="button" className="btn-primary" onClick={handleCarnet}>
              Generar carnet
            </button>
          </div>
        </div>
      </div>

      <div className="sales-kpis">
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">DNI</span>
          <span className="sales-kpi-value" style={{ fontSize: '1.1rem' }}>{socio.dni}</span>
        </div>
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">Tipo</span>
          <span className="sales-kpi-value" style={{ fontSize: '1.1rem' }}>{socio.socioTipo?.nombre}</span>
        </div>
        <div className="sales-kpi-card">
          <span className="sales-kpi-label">Deuda pendiente</span>
          <span className={`sales-kpi-value ${deudaTotal > 0 ? 'warning-text' : 'success-text'}`} style={{ fontSize: '1.1rem' }}>
            {formatCurrency(deudaTotal)}
          </span>
        </div>
      </div>

      <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
        <h3 className="settings-section-header">Datos del legajo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
          <div><strong>DNI:</strong> {socio.dni}</div>
          {socio.fechaNacimiento && <div><strong>Fecha nac.:</strong> {formatDate(socio.fechaNacimiento)}</div>}
          {socio.telefono && <div><strong>Telefono:</strong> {socio.telefono}</div>}
          {socio.direccion && <div><strong>Direccion:</strong> {socio.direccion}</div>}
          <div><strong>Fecha de alta:</strong> {formatDate(socio.fechaAlta)}</div>
          <div><strong>Estado:</strong> {socio.estado}</div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header">Cuotas</h3>
        {cuotasLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" aria-hidden="true" />
          </div>
        ) : cuotas.length === 0 ? (
          <p style={{ color: 'var(--color-text-faint)' }}>No hay cuotas registradas.</p>
        ) : (
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date" style={{ flex: '0 0 120px' }}>Periodo</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Monto</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Pagado</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Pendiente</span>
              <span className="col-method" style={{ flex: '0 0 90px' }}>Estado</span>
              <span className="col-user" style={{ flex: 1 }}>Pagos</span>
              <span className="col-action" style={{ flex: '0 0 90px' }}></span>
            </div>
            {cuotas.map((c: SocioCuotaItem) => {
              const pendiente = Math.max(0, Number(c.montoOriginal) - Number(c.montoPagado));
              return (
                <div key={c.id} className="sales-table-row">
                  <span className="col-date" style={{ flex: '0 0 120px' }}>
                    {MONTH_NAMES[c.mes - 1]} {c.anio}
                  </span>
                  <span className="col-total" style={{ flex: '0 0 100px' }}>{formatCurrency(Number(c.montoOriginal))}</span>
                  <span className="col-total" style={{ flex: '0 0 100px', color: 'var(--color-success)' }}>
                    {formatCurrency(Number(c.montoPagado))}
                  </span>
                  <span className="col-total" style={{ flex: '0 0 100px', color: pendiente > 0 ? 'var(--color-danger)' : undefined, fontWeight: pendiente > 0 ? 600 : undefined }}>
                    {formatCurrency(pendiente)}
                  </span>
                  <span className="col-method" style={{ flex: '0 0 90px' }}>{cuotaEstadoBadge(c.estado)}</span>
                  <span className="col-user" style={{ flex: 1, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    {c.pagos && c.pagos.length > 0
                      ? c.pagos.map((p) => `${formatDate(p.fecha)} $${p.monto}`).join(' · ')
                      : '--'}
                  </span>
                  <span className="col-action" style={{ flex: '0 0 90px' }}>
                    {c.estado !== 'PAGADO' && (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openPagoModal(c)}>
                        Pagar
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                <label>Fecha *</label>
                <input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <label>Observacion</label>
                <textarea
                  rows={2}
                  value={pagoForm.observacion}
                  onChange={(e) => setPagoForm({ ...pagoForm, observacion: e.target.value })}
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

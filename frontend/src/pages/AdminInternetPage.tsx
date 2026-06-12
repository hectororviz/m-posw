import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useInternetPlans } from '../api/queries';
import type { InternetPlan } from '../api/types';
import { useToast } from '../components/ToastProvider';

const DURATION_OPTIONS = [
  { label: '1 hora', value: 3600 },
  { label: '3 horas', value: 10800 },
  { label: '6 horas', value: 21600 },
  { label: '12 horas', value: 43200 },
  { label: '24 horas', value: 86400 },
  { label: '48 horas', value: 172800 },
  { label: '7 dias', value: 604800 },
  { label: '15 dias', value: 1296000 },
  { label: '30 dias', value: 2592000 },
];

const BW_OPTIONS = ['1M', '2M', '3M', '5M', '10M', '20M', '50M', '100M'];

const defaultDuration = DURATION_OPTIONS[4].value;

const emptyForm = {
  name: '',
  duration: defaultDuration,
  price: 0,
  downloadBandwidth: '10M',
  uploadBandwidth: '2M',
  idleTimeout: 1800,
};

type FormState = typeof emptyForm;

export const AdminInternetPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useInternetPlans();
  const { pushToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (plan: InternetPlan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      duration: plan.duration,
      price: Number(plan.price),
      downloadBandwidth: plan.downloadBandwidth,
      uploadBandwidth: plan.uploadBandwidth,
      idleTimeout: plan.idleTimeout,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (form.price <= 0) {
      setError('El precio debe ser mayor a 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiClient.patch(`/internet/plans/${editingId}`, form);
        pushToast('Plan actualizado', 'success');
      } else {
        await apiClient.post('/internet/plans', form);
        pushToast('Plan creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      setModalOpen(false);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: InternetPlan) => {
    if (!confirm(`¿Eliminar el plan "${plan.name}"? Esto tambien eliminara el producto asociado.`)) return;
    setDeleting(plan.id);
    try {
      await apiClient.delete(`/internet/plans/${plan.id}`);
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      pushToast('Plan eliminado', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400} d`;
    if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
    if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
    return `${seconds}s`;
  };

  const nonCustom = DURATION_OPTIONS.map((o) => o.value);

  if (isLoading) return <div className="loading-indicator">Cargando...</div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Planes de Internet</h2>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Agregar plan
          </button>
        </div>

        {(!plans || plans.length === 0) && (
          <p className="empty-state">
            No hay planes configurados. Crea uno para que aparezca como producto en el POS.
          </p>
        )}

        {plans && plans.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Duracion</th>
                <th>Descarga</th>
                <th>Subida</th>
                <th>Precio</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.name}</td>
                  <td>{formatDuration(plan.duration)}</td>
                  <td>{plan.downloadBandwidth}</td>
                  <td>{plan.uploadBandwidth}</td>
                  <td>${Number(plan.price).toFixed(0)}</td>
                  <td>{plan.active ? 'Si' : 'No'}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-small" onClick={() => openEdit(plan)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-small btn-danger"
                        disabled={deleting === plan.id}
                        onClick={() => handleDelete(plan)}
                      >
                        {deleting === plan.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {modalOpen && (
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingId ? 'Editar plan' : 'Nuevo plan'}</h3>

              {error && <p className="form-error">{error}</p>}

              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Internet 24 horas"
                />
              </div>

              <div className="form-group">
                <label>Duracion</label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="-1" disabled>
                    ──────
                  </option>
                  {!nonCustom.includes(form.duration) && (
                    <option value={form.duration}>{formatDuration(form.duration)} (personalizado)</option>
                  )}
                </select>
                <div style={{ marginTop: '0.5rem' }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="Duracion personalizada en segundos"
                    value={nonCustom.includes(form.duration) ? '' : form.duration}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0) setForm({ ...form, duration: v });
                    }}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: 'var(--color-text-faint)' }}>
                    Para duraciones no listadas, ingresa los segundos manualmente (ej: 10800 = 3 horas)
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Descarga</label>
                  <select
                    value={form.downloadBandwidth}
                    onChange={(e) => setForm({ ...form, downloadBandwidth: e.target.value })}
                  >
                    {BW_OPTIONS.map((bw) => (
                      <option key={bw} value={bw}>{bw}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Subida</label>
                  <select
                    value={form.uploadBandwidth}
                    onChange={(e) => setForm({ ...form, uploadBandwidth: e.target.value })}
                  >
                    {BW_OPTIONS.map((bw) => (
                      <option key={bw} value={bw}>{bw}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Precio (ARS)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

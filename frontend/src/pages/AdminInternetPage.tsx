import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useInternetPlans } from '../api/queries';
import type { InternetPlan } from '../api/types';

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

interface PlanForm {
  name: string;
  duration: number;
  price: string;
  downloadBandwidth: string;
  uploadBandwidth: string;
  idleTimeout: number;
  customDuration: boolean;
}

const EMPTY_FORM: PlanForm = {
  name: '',
  duration: defaultDuration,
  price: '',
  downloadBandwidth: '10M',
  uploadBandwidth: '2M',
  idleTimeout: 1800,
  customDuration: false,
};

const isPreset = (seconds: number) => DURATION_OPTIONS.some((o) => o.value === seconds);

const formatDuration = (seconds: number) => {
  if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400} d`;
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds}s`;
};

export const AdminInternetPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useInternetPlans();
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<InternetPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (plan: InternetPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      duration: plan.duration,
      price: String(plan.price),
      downloadBandwidth: plan.downloadBandwidth,
      uploadBandwidth: plan.uploadBandwidth,
      idleTimeout: plan.idleTimeout,
      customDuration: !isPreset(plan.duration),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    const priceNum = Number(form.price);
    if (!priceNum || priceNum <= 0) {
      setError('El precio debe ser mayor a 0');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        duration: form.duration,
        price: priceNum,
        downloadBandwidth: form.downloadBandwidth,
        uploadBandwidth: form.uploadBandwidth,
        idleTimeout: form.idleTimeout,
      };
      if (editingPlan) {
        await apiClient.patch(`/internet/plans/${editingPlan.id}`, payload);
      } else {
        await apiClient.post('/internet/plans', payload);
      }
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: InternetPlan) => {
    setError(null);
    setDeletingId(plan.id);
    try {
      await apiClient.delete(`/internet/plans/${plan.id}`);
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const getPriceDisplay = (price: number | string) => {
    const num = typeof price === 'string' ? Number(price) : price;
    return `$${num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-header-title">Planes de Internet</h2>
          <p className="page-header-subtitle">Gestiona los vouchers WiFi que se venden en el POS.</p>
        </div>
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Planes de Internet</h2>
          <p className="page-header-subtitle">Gestiona los vouchers WiFi que se venden en el POS. Cada plan crea automaticamente un producto en la categoria Internet.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo plan" title="Nuevo plan">+</button>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPlan ? 'Editar plan' : 'Nuevo plan'}</h3>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">
              <div className="settings-field">
                <label htmlFor="plan-name">Nombre</label>
                <input id="plan-name" type="text" placeholder="Internet 24 horas" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="settings-field">
                <label htmlFor="plan-duration">Duracion</label>
                <select
                  id="plan-duration"
                  value={form.customDuration ? -1 : form.duration}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val === -1) {
                      setForm({ ...form, customDuration: true, duration: 0 });
                    } else {
                      setForm({ ...form, customDuration: false, duration: val });
                    }
                  }}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  <option value={-1}>Personalizado...</option>
                </select>
                {form.customDuration && (
                  <input
                    type="number"
                    min="1"
                    placeholder="Duracion en segundos"
                    value={form.duration || ''}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })}
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </div>

              <div className="settings-field">
                <label htmlFor="plan-down">Velocidad de descarga</label>
                <select id="plan-down" value={form.downloadBandwidth} onChange={(e) => setForm({ ...form, downloadBandwidth: e.target.value })}>
                  {BW_OPTIONS.map((bw) => (
                    <option key={bw} value={bw}>{bw}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label htmlFor="plan-up">Velocidad de subida</label>
                <select id="plan-up" value={form.uploadBandwidth} onChange={(e) => setForm({ ...form, uploadBandwidth: e.target.value })}>
                  {BW_OPTIONS.map((bw) => (
                    <option key={bw} value={bw}>{bw}</option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label htmlFor="plan-price">Precio</label>
                <div className="price-input-wrapper">
                  <span className="price-input-symbol">$</span>
                  <input id="plan-price" type="number" min="0" step="1" placeholder="2000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>

              <div className="settings-field" style={{ marginBottom: 0 }}>
                <label htmlFor="plan-idle">Timeout de inactividad (segundos)</label>
                <input id="plan-idle" type="number" min="0" step="1" value={form.idleTimeout} onChange={(e) => setForm({ ...form, idleTimeout: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>{editingPlan ? 'Guardar cambios' : 'Crear plan'}</button>
            </div>
          </div>
        </div>
      )}

      {!plans || plans.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>
            No hay planes de internet configurados.
          </p>
          <p style={{ color: 'var(--color-text-faint)', margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            Crea uno para que aparezca como producto en la categoria Internet del POS.
          </p>
        </div>
      ) : (
        <div className="product-grid-v2">
          {plans.map((plan) => (
            <div key={plan.id} className={`product-card-v2 ${!plan.active ? 'is-inactive' : ''}`}>
              <div className="product-card-v2-media product-card-v2-media--category" style={{ background: 'var(--color-surface-raised)' }}>
                <span className="product-card-v2-icon">📶</span>
              </div>
              <div className="product-card-v2-info">
                <span className="product-card-v2-name">{plan.name}</span>
              </div>
              <div className="product-card-v2-meta">
                <span className="product-card-v2-price">{getPriceDisplay(plan.price)}</span>
                <span className="product-card-v2-badge">{formatDuration(plan.duration)} &middot; {plan.downloadBandwidth} / {plan.uploadBandwidth}</span>
              </div>
              <div className="product-card-v2-actions">
                <button type="button" className="btn-ghost" onClick={() => openEdit(plan)} style={{ padding: '0.3rem 0.5rem' }} aria-label={`Editar ${plan.name}`}>✎</button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={deletingId === plan.id}
                  onClick={() => handleDelete(plan)}
                  style={{ padding: '0.3rem 0.5rem', color: 'var(--color-danger-text)' }}
                  aria-label={`Eliminar ${plan.name}`}
                >
                  {deletingId === plan.id ? '...' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

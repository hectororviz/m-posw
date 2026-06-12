import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useInternetPlans, useInternetVouchers } from '../api/queries';
import type { InternetPlan } from '../api/types';

type TabId = 'vouchers' | 'planes';

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

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const AdminInternetPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: plans, isLoading: plansLoading } = useInternetPlans();
  const { data: vouchers, isLoading: vouchersLoading } = useInternetVouchers();
  const [activeTab, setActiveTab] = useState<TabId>('vouchers');
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
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0) { setError('El precio no puede ser negativo'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), duration: form.duration, price: priceNum, downloadBandwidth: form.downloadBandwidth, uploadBandwidth: form.uploadBandwidth, idleTimeout: form.idleTimeout };
      if (editingPlan) {
        await apiClient.patch(`/internet/plans/${editingPlan.id}`, payload);
      } else {
        await apiClient.post('/internet/plans', payload);
      }
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) { setError(normalizeApiError(err)); } finally { setSaving(false); }
  };

  const handleDelete = async (plan: InternetPlan) => {
    setError(null);
    setDeletingId(plan.id);
    try {
      await apiClient.delete(`/internet/plans/${plan.id}`);
      await queryClient.invalidateQueries({ queryKey: ['internet-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) { setError(normalizeApiError(err)); } finally { setDeletingId(null); }
  };

  const getPriceDisplay = (price: number | string) => {
    const num = typeof price === 'string' ? Number(price) : price;
    return `$${num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'vouchers', label: 'Vouchers' },
    { id: 'planes', label: 'Planes' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Internet</h2>
          <p className="page-header-subtitle">Gestiona los vouchers WiFi y planes de internet.</p>
        </div>
      </div>

      <nav className="treasury-subnav" style={{ marginBottom: '1.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`treasury-subnav-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <p className="error-text">{error}</p>}

      {/* TAB: Vouchers */}
      {activeTab === 'vouchers' && (
        <>
          {vouchersLoading ? (
            <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div className="spinner" aria-hidden="true" />
              <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
            </div>
          ) : !vouchers || vouchers.length === 0 ? (
            <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>No hay vouchers vendidos todavia.</p>
              <p style={{ color: 'var(--color-text-faint)', margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Cuando se venda un plan de internet, los vouchers apareceran aca.</p>
            </div>
          ) : (
            <div className="sales-table-wrapper">
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Fecha</span>
                  <span className="col-type">Venta</span>
                  <span className="col-user">Plan</span>
                  <span className="col-method">Estado</span>
                </div>
                {vouchers.map((v) => (
                  <div key={v.id} className="sales-table-row">
                    <span className="col-date">{formatDateTime(v.saleCreatedAt)}</span>
                    <span className="col-type">#{v.saleOrderNumber}</span>
                    <span className="col-user">{v.planName}</span>
                    <span className="col-method">
                      {v.active ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-neutral">Usado</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: Planes */}
      {activeTab === 'planes' && (
        <>
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
                    <select id="plan-duration" value={form.customDuration ? -1 : form.duration} onChange={(e) => { const v = Number(e.target.value); if (v === -1) setForm({ ...form, customDuration: true, duration: 0 }); else setForm({ ...form, customDuration: false, duration: v }); }}>
                      {DURATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      <option value={-1}>Personalizado...</option>
                    </select>
                    {form.customDuration && <input type="number" min="1" placeholder="Duracion en segundos" value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })} style={{ marginTop: '0.5rem' }} />}
                  </div>
                  <div className="settings-field">
                    <label htmlFor="plan-down">Velocidad de descarga</label>
                    <select id="plan-down" value={form.downloadBandwidth} onChange={(e) => setForm({ ...form, downloadBandwidth: e.target.value })}>
                      {BW_OPTIONS.map((bw) => (<option key={bw} value={bw}>{bw}</option>))}
                    </select>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="plan-up">Velocidad de subida</label>
                    <select id="plan-up" value={form.uploadBandwidth} onChange={(e) => setForm({ ...form, uploadBandwidth: e.target.value })}>
                      {BW_OPTIONS.map((bw) => (<option key={bw} value={bw}>{bw}</option>))}
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

          {plansLoading ? (
            <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div className="spinner" aria-hidden="true" />
              <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
            </div>
          ) : !plans || plans.length === 0 ? (
            <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>No hay planes configurados.</p>
              <p style={{ color: 'var(--color-text-faint)', margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Crea uno para que aparezca como producto en la categoria Internet del POS.</p>
            </div>
          ) : (
            <div className="sales-table-wrapper">
              <div className="sales-table">
                <div className="sales-table-head">
                  <span className="col-date">Nombre</span>
                  <span className="col-user">Duracion</span>
                  <span className="col-total" style={{ flex: '0 0 180px' }}>Ancho de banda</span>
                  <span className="col-total" style={{ flex: '0 0 110px' }}>Precio</span>
                  <span className="col-method" style={{ flex: '0 0 70px' }}>Activo</span>
                  <span className="col-action" style={{ flex: '0 0 80px' }}></span>
                </div>
                {plans.map((plan) => (
                  <div key={plan.id} className={`sales-table-row ${!plan.active ? 'row-inactive' : ''}`}>
                    <span className="col-date" style={{ fontWeight: 500 }}>{plan.name}</span>
                    <span className="col-user">{formatDuration(plan.duration)}</span>
                    <span className="col-total" style={{ flex: '0 0 180px', color: 'var(--color-text-faint)' }}>{plan.downloadBandwidth} / {plan.uploadBandwidth}</span>
                    <span className="col-total" style={{ flex: '0 0 110px', fontWeight: 600 }}>{getPriceDisplay(plan.price)}</span>
                    <span className="col-method" style={{ flex: '0 0 70px' }}>
                      {plan.active ? (
                        <span className="badge badge-success">Si</span>
                      ) : (
                        <span className="badge badge-neutral">No</span>
                      )}
                    </span>
                    <span className="col-action" style={{ flex: '0 0 80px', display: 'flex', gap: '0.25rem' }}>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(plan)} aria-label={`Editar ${plan.name}`}>✎</button>
                      <button type="button" className="btn-ghost btn-sm" disabled={deletingId === plan.id} onClick={() => handleDelete(plan)} style={{ color: 'var(--color-danger-text)' }} aria-label={`Eliminar ${plan.name}`}>{deletingId === plan.id ? '...' : '✕'}</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

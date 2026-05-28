import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedores, useAcreedorDeuda } from '../api/queries';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const AcreedorSaldo: React.FC<{ acreedorId: number }> = ({ acreedorId }) => {
  const { data } = useAcreedorDeuda(acreedorId);
  if (!data) return <span>--</span>;
  return (
    <span className={data.saldoPendiente > 0 ? 'warning-text' : 'success-text'}>
      {formatCurrency(data.saldoPendiente)}
    </span>
  );
};

export const AdminAcreedoresPage: React.FC = () => {
  const { data: acreedores = [], isLoading } = useAcreedores();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ nombre: '', telefono: '', notas: '' });
    setEditingId(null);
    setError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (id: number) => {
    const a = acreedores.find((ac) => ac.id === id);
    if (!a) return;
    setForm({ nombre: a.nombre, telefono: a.telefono ?? '', notas: a.notas ?? '' });
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
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await apiClient.patch(`/acreedores/${id}/toggle`);
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      pushToast('Estado actualizado', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Acreedores</h2>
            <p className="page-header-subtitle">Control de ventas fiadas y pagos de acreedores.</p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreateModal}>+ Nuevo acreedor</button>
        </div>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      ) : acreedores.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>No hay acreedores registrados.</p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date">Nombre</span>
              <span className="col-user">Telefono</span>
              <span className="col-total">Saldo pendiente</span>
              <span className="col-method">Estado</span>
              <span className="col-action"></span>
            </div>
            {acreedores.map((a) => (
              <div key={a.id} className="sales-table-row">
                <span className="col-date" style={{ fontWeight: 500 }}>{a.nombre}</span>
                <span className="col-user">{a.telefono || '--'}</span>
                <span className="col-total">
                  <AcreedorSaldo acreedorId={a.id} />
                </span>
                <span className="col-method">
                  {a.activo ? (
                    <span className="badge badge-success">Activo</span>
                  ) : (
                    <span className="badge badge-neutral">Inactivo</span>
                  )}
                </span>
                <span className="col-action" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/admin/acreedores/${a.id}`)}>Ver</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEditModal(a.id)}>Editar</button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => handleToggle(a.id)}
                  >
                    {a.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar acreedor' : 'Nuevo acreedor'}</h3>
              <button className="icon-button" onClick={() => { setModalOpen(false); resetForm(); }}>✕</button>
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
                <label>Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Telefono"
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
    </div>
  );
};

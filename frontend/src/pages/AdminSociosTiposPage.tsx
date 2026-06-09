import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSociosTipos } from '../api/queries';
import type { SocioTipo } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const AdminSociosTiposPage: React.FC = () => {
  const { data: tipos = [], isLoading } = useSociosTipos();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', montoMensual: 0, comentario: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const resetForm = () => {
    setForm({ nombre: '', montoMensual: 0, comentario: '', activo: true });
    setEditingId(null);
    setError(null);
    setShowWarning(false);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const t = tipos.find((tp) => tp.id === id);
    if (!t) return;
    setForm({
      nombre: t.nombre,
      montoMensual: Number(t.montoMensual),
      comentario: t.comentario ?? '',
      activo: t.activo,
    });
    setEditingId(id);
    setError(null);
    setShowWarning(false);
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
        const original = tipos.find((t) => t.id === editingId);
        if (original && Number(original.montoMensual) !== form.montoMensual && !showWarning) {
          setShowWarning(true);
          setSaving(false);
          return;
        }
        await apiClient.put(`/socios/tipos/${editingId}`, {
          nombre: form.nombre,
          montoMensual: form.montoMensual,
          comentario: form.comentario || undefined,
        });
        pushToast('Tipo de socio actualizado', 'success');
      } else {
        await apiClient.post('/socios/tipos', {
          nombre: form.nombre,
          montoMensual: form.montoMensual,
          comentario: form.comentario || undefined,
        });
        pushToast('Tipo de socio creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['socios-tipos'] });
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/socios/tipos/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['socios-tipos'] });
      pushToast('Tipo de socio desactivado', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Tipos de Socio</h2>
        <p className="page-header-subtitle">Administra las categorias y montos mensuales.</p>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      ) : tipos.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>No hay tipos de socio registrados.</p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date" style={{ flex: '0 0 180px' }}>Nombre</span>
              <span className="col-total" style={{ flex: '0 0 130px' }}>Monto mensual</span>
              <span className="col-user" style={{ flex: 1 }}>Comentario</span>
              <span className="col-method" style={{ flex: '0 0 80px' }}>Estado</span>
              <span className="col-action" style={{ flex: '0 0 130px' }}></span>
            </div>
            {tipos.map((t: SocioTipo) => (
              <div key={t.id} className="sales-table-row">
                <span className="col-date" style={{ flex: '0 0 180px', fontWeight: 500 }}>{t.nombre}</span>
                <span className="col-total" style={{ flex: '0 0 130px', fontWeight: 600 }}>
                  {formatCurrency(Number(t.montoMensual))}
                </span>
                <span className="col-user" style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {t.comentario || '--'}
                </span>
                <span className="col-method" style={{ flex: '0 0 80px' }}>
                  {t.activo ? (
                    <span className="badge badge-success">Activo</span>
                  ) : (
                    <span className="badge badge-neutral">Inactivo</span>
                  )}
                </span>
                <span className="col-action" style={{ flex: '0 0 130px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(t.id)}>Editar</button>
                  {t.activo && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => handleDelete(t.id)}>Baja</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="fab-button-v2"
        onClick={openCreate}
        aria-label="Nuevo tipo"
        title="Nuevo tipo"
      >
        +
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar tipo' : 'Nuevo tipo'}</h3>
              <button className="icon-button" onClick={() => { setModalOpen(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              {showWarning && (
                <div className="alerta-deuda-banner" style={{ marginBottom: '0.75rem' }}>
                  Esto cambiara el importe de las cuotas futuras. Las cuotas ya generadas no se modifican.
                </div>
              )}
              <div className="settings-field">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del tipo"
                />
              </div>
              <div className="settings-field">
                <label>Monto mensual *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.montoMensual}
                  onChange={(e) => setForm({ ...form, montoMensual: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="settings-field">
                <label>Comentario</label>
                <textarea
                  rows={2}
                  value={form.comentario}
                  onChange={(e) => setForm({ ...form, comentario: e.target.value })}
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

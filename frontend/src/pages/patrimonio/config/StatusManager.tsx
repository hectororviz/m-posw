import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../../api/client';
import { useAssetStatuses } from '../../../api/queries';
import { useToast } from '../../../components/ToastProvider';

export const StatusManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: statuses, isLoading } = useAssetStatuses();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      await apiClient.post('/asset-statuses', { name: newName.trim() });
      pushToast('Estado creado', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
      setNewName('');
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al crear');
    }
  };

  const handleUpdate = async () => {
    if (!editName.trim() || editingId == null) return;
    setError(null);
    try {
      await apiClient.patch(`/asset-statuses/${editingId}`, { name: editName.trim() });
      pushToast('Estado actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
      setEditingId(null);
      setEditName('');
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al editar');
    }
  };

  const handleToggle = async (id: number) => {
    setError(null);
    try {
      await apiClient.patch(`/asset-statuses/${id}/toggle`);
      pushToast('Estado actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al cambiar estado');
      pushToast(typeof msg === 'string' ? msg : 'Error al cambiar estado', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await apiClient.delete(`/asset-statuses/${id}`);
      pushToast('Estado eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-statuses'] });
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al eliminar');
      pushToast(typeof msg === 'string' ? msg : 'Error al eliminar', 'error');
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-header">Estados</h3>
      <p className="settings-section-desc">
        Los estados <strong>Activo</strong> y <strong>De Baja</strong> son del sistema y no se pueden modificar.
        Podés crear estados intermedios adicionales.
      </p>

      {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

      <div className="sales-table-wrapper">
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-method" style={{ flex: '0 0 120px' }}>Tipo</span>
            <span className="col-method" style={{ flex: '0 0 90px' }}>Estado</span>
            <span className="col-num" style={{ flex: '0 0 70px' }}>Bienes</span>
            <span className="col-action" style={{ flex: '0 0 100px', textAlign: 'right' }}>Acciones</span>
          </div>

          {isLoading && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span>
            </div>
          )}
          {!isLoading && (!statuses || statuses.length === 0) && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No hay estados</span>
            </div>
          )}
          {statuses?.map((st) => (
            <div key={st.id} className="sales-table-row" style={!st.isActive ? { opacity: 0.5 } : undefined}>
              <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>
                {editingId === st.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleUpdate}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                    style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderRadius: '0.4rem', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)' }}
                  />
                ) : (
                  st.name
                )}
              </span>
              <span className="col-method" style={{ flex: '0 0 120px' }}>
                {st.isSystem ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>
                    <Lock size={12} /> Sistema
                  </span>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Personalizado</span>
                )}
              </span>
              <span className="col-method" style={{ flex: '0 0 90px' }}>
                {st.isActive ? (
                  <span className="badge badge-success">Activo</span>
                ) : (
                  <span className="badge badge-neutral">Inactivo</span>
                )}
              </span>
              <span className="col-num" style={{ flex: '0 0 70px', color: 'var(--color-text-muted)' }}>{st._count?.assets ?? 0}</span>
              <span className="col-action" style={{ flex: '0 0 100px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                {!st.isSystem && (
                  <>
                    <button className="btn-ghost" onClick={() => { setEditingId(st.id); setEditName(st.name); }} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => handleToggle(st.id)} title={st.isActive ? 'Desactivar' : 'Activar'} style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                      {st.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                    <button className="btn-ghost" onClick={() => handleDelete(st.id)} title="Eliminar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nuevo estado..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          style={{ flex: 1, maxWidth: 400, padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)' }}
        />
        <button type="button" className="btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
          <Plus size={16} style={{ marginRight: 4 }} />
          Agregar
        </button>
      </div>
    </div>
  );
};

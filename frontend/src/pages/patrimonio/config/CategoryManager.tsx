import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../../api/client';
import { useAssetCategories } from '../../../api/queries';
import { useToast } from '../../../components/ToastProvider';

export const CategoryManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: categories, isLoading } = useAssetCategories();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      await apiClient.post('/asset-categories', { name: newName.trim() });
      pushToast('Categoría creada', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
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
      await apiClient.patch(`/asset-categories/${editingId}`, { name: editName.trim() });
      pushToast('Categoría actualizada', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
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
      await apiClient.patch(`/asset-categories/${id}/toggle`);
      pushToast('Estado actualizado', 'success');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setError(typeof msg === 'string' ? msg : 'Error al cambiar estado');
      pushToast(typeof msg === 'string' ? msg : 'Error al cambiar estado', 'error');
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-header">Categorías</h3>

      {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

      <div className="sales-table-wrapper">
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Nombre</span>
            <span className="col-method" style={{ flex: '0 0 100px' }}>Estado</span>
            <span className="col-num" style={{ flex: '0 0 70px' }}>Bienes</span>
            <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right' }}>Acciones</span>
          </div>

          {isLoading && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Cargando...</span>
            </div>
          )}
          {!isLoading && (!categories || categories.length === 0) && (
            <div className="sales-table-row">
              <span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No hay categorías</span>
            </div>
          )}
          {categories?.map((cat) => (
            <div key={cat.id} className="sales-table-row" style={!cat.isActive ? { opacity: 0.5 } : undefined}>
              <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>
                {editingId === cat.id ? (
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
                  cat.name
                )}
              </span>
              <span className="col-method" style={{ flex: '0 0 100px' }}>
                {cat.isActive ? (
                  <span className="badge badge-success">Activa</span>
                ) : (
                  <span className="badge badge-neutral">Inactiva</span>
                )}
              </span>
              <span className="col-num" style={{ flex: '0 0 70px', color: 'var(--color-text-muted)' }}>{cat._count?.assets ?? 0}</span>
              <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                <button className="btn-ghost" onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                  <Pencil size={14} />
                </button>
                <button className="btn-ghost" onClick={() => handleToggle(cat.id)} title={cat.isActive ? 'Desactivar' : 'Activar'} style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}>
                  {cat.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nueva categoría..."
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

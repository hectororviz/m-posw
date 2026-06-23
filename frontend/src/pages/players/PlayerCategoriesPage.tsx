import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../../api/client';
import { usePlayerCategories } from '../../api/queries';
import { useToast } from '../../components/ToastProvider';
import { Plus, X } from 'lucide-react';
import type { PlayerCategory } from '../../api/types';

const RESTRICTION_LABELS: Record<string, string> = {
  AGE: 'Por edad',
  BIRTH_YEAR: 'Por año de nacimiento',
};

export const PlayerCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: categories, isLoading } = usePlayerCategories();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<PlayerCategory | null>(null);

  const [form, setForm] = useState({
    name: '',
    restrictionType: 'AGE' as 'AGE' | 'BIRTH_YEAR',
    ageMin: '',
    ageMax: '',
    ageCutoffMonth: '12',
    ageCutoffDay: '31',
    birthYear: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', restrictionType: 'AGE', ageMin: '', ageMax: '', ageCutoffMonth: '12', ageCutoffDay: '31', birthYear: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (cat: PlayerCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      restrictionType: cat.restrictionType,
      ageMin: cat.ageMin?.toString() ?? '',
      ageMax: cat.ageMax?.toString() ?? '',
      ageCutoffMonth: cat.ageCutoffMonth?.toString() ?? '12',
      ageCutoffDay: cat.ageCutoffDay?.toString() ?? '31',
      birthYear: cat.birthYear?.toString() ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    if (form.restrictionType === 'BIRTH_YEAR' && !form.birthYear) {
      setFormError('El año de nacimiento es obligatorio para este tipo');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        restrictionType: form.restrictionType,
      };
      if (form.restrictionType === 'BIRTH_YEAR') {
        payload.birthYear = +form.birthYear;
      } else {
        if (form.ageMin) payload.ageMin = +form.ageMin;
        if (form.ageMax) payload.ageMax = +form.ageMax;
        payload.ageCutoffMonth = +form.ageCutoffMonth;
        payload.ageCutoffDay = +form.ageCutoffDay;
      }

      if (editingId) {
        await apiClient.put(`/player-categories/${editingId}`, payload);
        pushToast('Categoría actualizada', 'success');
      } else {
        await apiClient.post('/player-categories', payload);
        pushToast('Categoría creada', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['player-categories'] });
      setModalOpen(false);
    } catch (err: any) {
      setFormError(normalizeApiError(err) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/player-categories/${deleteConfirm.id}`);
      pushToast('Categoría eliminada', 'success');
      queryClient.invalidateQueries({ queryKey: ['player-categories'] });
      setDeleteConfirm(null);
    } catch (err: any) {
      const msg = normalizeApiError(err);
      pushToast(typeof msg === 'string' ? msg : 'Error al eliminar', 'error');
    }
  };

  const getRestrictionDesc = (cat: PlayerCategory) => {
    if (cat.restrictionType === 'BIRTH_YEAR') {
      return `Nacidos en ${cat.birthYear}`;
    }
    const month = cat.ageCutoffMonth ?? 12;
    const day = cat.ageCutoffDay ?? 31;
    const min = cat.ageMin != null ? cat.ageMin : '?';
    const max = cat.ageMax != null ? cat.ageMax : 'sin límite';
    return `Edad ${min}-${max} al ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Categorías</h2>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Restricción</th>
              <th>Torneos que la usan</th>
              <th style={{ width: '100px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>Cargando...</td></tr>
            ) : (categories ?? []).length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay categorías configuradas</td></tr>
            ) : (
              (categories ?? []).map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td>{RESTRICTION_LABELS[cat.restrictionType] ?? cat.restrictionType}</td>
                  <td>{getRestrictionDesc(cat)}</td>
                  <td>{(cat.tournaments ?? []).map((t) => t.name).join(', ') || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(cat)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(cat)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button className="fab" onClick={openCreate} title="Agregar categoría">
        <Plus size={24} />
      </button>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="form-error">{formError}</p>}
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Sub-15" />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.restrictionType} onChange={(e) => setForm({ ...form, restrictionType: e.target.value as 'AGE' | 'BIRTH_YEAR' })}>
                  <option value="AGE">Por edad</option>
                  <option value="BIRTH_YEAR">Por año de nacimiento</option>
                </select>
              </div>
              {form.restrictionType === 'BIRTH_YEAR' ? (
                <div className="form-group">
                  <label>Año de nacimiento</label>
                  <input type="number" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} placeholder="Ej: 2015" />
                </div>
              ) : (
                <>
                  <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Edad mínima</label>
                      <input type="number" value={form.ageMin} onChange={(e) => setForm({ ...form, ageMin: e.target.value })} placeholder="Ej: 10" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Edad máxima</label>
                      <input type="number" value={form.ageMax} onChange={(e) => setForm({ ...form, ageMax: e.target.value })} placeholder="Dejar vacío = sin límite" />
                    </div>
                  </div>
                  <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Día de corte</label>
                      <input type="number" min={1} max={31} value={form.ageCutoffDay} onChange={(e) => setForm({ ...form, ageCutoffDay: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Mes de corte</label>
                      <input type="number" min={1} max={12} value={form.ageCutoffMonth} onChange={(e) => setForm({ ...form, ageCutoffMonth: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Eliminar categoría</h3>
            </div>
            <div className="modal-body">
              <p>¿Eliminar la categoría "{deleteConfirm.name}"?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

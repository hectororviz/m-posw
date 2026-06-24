import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient, normalizeApiError } from '../../../api/client';
import { useAsset, useAssetCategories } from '../../../api/queries';
import { useToast } from '../../../components/ToastProvider';

interface Props {
  editingId: number | null;
  onClose: () => void;
}

export const AssetForm: React.FC<Props> = ({ editingId, onClose }) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: existingAsset } = useAsset(editingId ?? undefined);
  const { data: categories } = useAssetCategories();

  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '' as string | number,
    location: '',
    acquisitionDate: '',
    acquisitionValue: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCategories = categories?.filter((c) => c.isActive) ?? [];

  useEffect(() => {
    if (editingId && existingAsset) {
      setForm({
        name: existingAsset.name,
        description: existingAsset.description ?? '',
        categoryId: existingAsset.categoryId,
        location: existingAsset.location ?? '',
        acquisitionDate: existingAsset.acquisitionDate ? existingAsset.acquisitionDate.slice(0, 10) : '',
        acquisitionValue: existingAsset.acquisitionValue != null ? String(existingAsset.acquisitionValue) : '',
        notes: existingAsset.notes ?? '',
      });
    } else {
      setForm({ name: '', description: '', categoryId: '', location: '', acquisitionDate: '', acquisitionValue: '', notes: '' });
    }
  }, [editingId, existingAsset]);

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim() || !form.categoryId) {
      setFormError('Completá los campos obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: +form.categoryId,
        location: form.location.trim() || undefined,
        acquisitionDate: form.acquisitionDate || undefined,
        acquisitionValue: form.acquisitionValue || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingId) {
        await apiClient.patch(`/assets/${editingId}`, payload);
        pushToast('Bien actualizado', 'success');
      } else {
        await apiClient.post('/assets', payload);
        pushToast('Bien creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    } catch (err: any) {
      const msg = normalizeApiError(err);
      setFormError(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingId ? 'Editar bien' : 'Nuevo bien'}</h3>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {formError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{formError}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="settings-field">
              <label>Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del bien" autoFocus />
            </div>
            <div className="settings-field">
              <label>Descripción</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" />
            </div>
            <div className="settings-field">
              <label>Categoría *</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Seleccionar categoría</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label>Ubicación</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej: Oficina, Depósito..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="settings-field" style={{ marginBottom: 0 }}>
                <label>Fecha de adquisición</label>
                <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
              </div>
              <div className="settings-field" style={{ marginBottom: 0 }}>
                <label>Valor de adquisición</label>
                <input type="number" step="0.01" value={form.acquisitionValue} onChange={(e) => setForm({ ...form, acquisitionValue: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="settings-field" style={{ marginBottom: 0 }}>
              <label>Notas</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas..." style={{ minHeight: '70px' }} />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

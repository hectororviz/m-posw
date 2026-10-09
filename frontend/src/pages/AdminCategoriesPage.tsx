import { useMemo, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useAdminCategories } from '../api/queries';
import type { Category } from '../api/types';
import { ConfirmDialog } from '../components/ui/Modal';
import { IconPicker } from '../components/ui/Field';
import { useToast } from '../components/ToastProvider';

interface CategoryForm {
  name: string;
  iconName: string;
  colorHex: string;
  active: boolean;
  ticket: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  iconName: '🧾',
  colorHex: '#111827',
  active: true,
  ticket: true,
};

export const AdminCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: categories } = useAdminCategories();
  const [error, setError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [showModal, setShowModal] = useState(false);

  const openCreate = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      iconName: category.iconName,
      colorHex: category.colorHex,
      active: category.active,
      ticket: category.ticket,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const handleSave = async () => {
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (editingCategory) {
        await apiClient.patch(`/categories/${editingCategory.id}`, payload);
      } else {
        await apiClient.post('/categories', payload);
      }
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      pushToast(editingCategory ? 'Categoría actualizada' : 'Categoría creada', 'success');
    } catch (err) {
      const msg = normalizeApiError(err);
      setError(msg);
      pushToast(msg, 'error');
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      await apiClient.delete(`/categories/${deleteTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async (categoryId: string, file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/categories/${categoryId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const rendered = useMemo(() => categories ?? [], [categories]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Categorías</h2>
            <p className="page-header-subtitle">Organiza los productos en categorias para el punto de venta.</p>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nueva categoria" title="Nueva categoria"><Plus size={24} /></button>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCategory ? 'Editar categoria' : 'Nueva categoria'}</h3>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              <div className="settings-field">
                <label htmlFor="cat-name">Nombre</label>
                <input id="cat-name" type="text" placeholder="Nombre de la categoría" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="settings-field">
                <label htmlFor="cat-icon">Ícono</label>
                <IconPicker id="cat-icon" value={form.iconName} onChange={(v) => setForm({ ...form, iconName: v })} />
              </div>
              <div className="settings-field">
                <label htmlFor="cat-color">Color</label>
                <input id="cat-color" type="color" value={form.colorHex} onChange={(e) => setForm({ ...form, colorHex: e.target.value })} style={{ height: '42px', padding: '4px', maxWidth: '100px' }} />
              </div>
              <div className="settings-field" style={{ marginBottom: 0 }}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  <span className="toggle-switch-track" />
                  Activa
                </label>
              </div>
              <div className="settings-field" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={form.ticket} onChange={(e) => setForm({ ...form, ticket: e.target.checked })} />
                  <span className="toggle-switch-track" />
                  Mostrar en ticket
                </label>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleSave}>{editingCategory ? 'Guardar cambios' : 'Crear categoria'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="product-grid-v2">
        {rendered.map((category) => {
          const imageUrl = buildImageUrl(category.imagePath, category.imageUpdatedAt);
          return (
            <div key={category.id} className={`product-card-v2 ${!category.active ? 'is-inactive' : ''}`}>
              <div className="product-card-v2-media product-card-v2-media--category">
                {imageUrl ? (
                  <img src={imageUrl} alt={category.name} />
                ) : (
                  <span className="product-card-v2-icon">{category.iconName || '🧾'}</span>
                )}
                <label className="product-card-v2-upload">
                  <input type="file" accept="image/*" onChange={(e) => handleUpload(category.id, e.target.files?.[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                </label>
              </div>
              <div className="product-card-v2-info">
                <span className="product-card-v2-name">{category.name}</span>
              </div>
              <div className="product-card-v2-actions">
                <button type="button" className="btn-ghost" onClick={() => openEdit(category)} style={{ padding: '0.3rem 0.5rem' }} aria-label={`Editar ${category.name}`}>{<Pencil size={16} />}</button>
                <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(category)} style={{ padding: '0.3rem 0.5rem', color: 'var(--color-danger-text)' }} aria-label={`Eliminar ${category.name}`}>{<X size={16} />}</button>
              </div>
            </div>
          );
        })}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar la categoría"
          message={`Se eliminará "${deleteTarget.name}" con sus productos. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          busy={deleting}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

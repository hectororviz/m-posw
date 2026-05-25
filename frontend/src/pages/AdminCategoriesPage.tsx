import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useAdminCategories } from '../api/queries';
import type { Category } from '../api/types';

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
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleDelete = async (categoryId: string) => {
    setError(null);
    try {
      await apiClient.delete(`/categories/${categoryId}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      setError(normalizeApiError(err));
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
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const rendered = useMemo(() => categories ?? [], [categories]);

  return (
    <section className="card admin-products">
      <h2>Categorías</h2>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className="fab-button"
        onClick={openCreate}
        aria-label="Nueva categoría"
        title="Nueva categoría"
      >
        <span aria-hidden="true">+</span>
      </button>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="product-form-fields">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Nombre de la categoría"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Icono</label>
                  <input
                    type="text"
                    placeholder="Emoji de la categoría"
                    value={form.iconName}
                    onChange={(event) => setForm({ ...form, iconName: event.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Color</label>
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(event) => setForm({ ...form, colorHex: event.target.value })}
                    style={{ height: '42px', padding: '4px' }}
                  />
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  />
                  Activa
                </label>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.ticket}
                    onChange={(event) => setForm({ ...form, ticket: event.target.checked })}
                  />
                  Ticket
                </label>
              </div>
            </div>
            <div className="checkout-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={handleSave}>
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="product-grid">
        {rendered.map((category) => {
          const imageUrl = buildImageUrl(category.imagePath, category.imageUpdatedAt);

          return (
            <div key={category.id} className={`product-card ${!category.active ? 'product-card--inactive' : ''}`}>
              <div className="product-card__image">
                {imageUrl ? (
                  <img src={imageUrl} alt={category.name} />
                ) : (
                  <span className="product-card__icon">{category.iconName || '🧾'}</span>
                )}
                <label className="product-card__image-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleUpload(category.id, event.target.files?.[0])}
                    className="product-card__file-input"
                  />
                </label>
              </div>

              <div className="product-card__info">
                <span className="product-card__name">{category.name}</span>
              </div>

              <div className="product-card__actions">
                <label className="product-card__active-toggle">
                  <input
                    type="checkbox"
                    checked={category.active}
                    onChange={async () => {
                      try {
                        await apiClient.patch(`/categories/${category.id}`, { active: !category.active });
                        await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
                      } catch (err) {
                        setError(normalizeApiError(err));
                      }
                    }}
                  />
                  <span>Activa</span>
                </label>
                <label className="product-card__active-toggle">
                  <input
                    type="checkbox"
                    checked={category.ticket}
                    onChange={async () => {
                      try {
                        await apiClient.patch(`/categories/${category.id}`, { ticket: !category.ticket });
                        await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
                      } catch (err) {
                        setError(normalizeApiError(err));
                      }
                    }}
                  />
                  <span>Ticket</span>
                </label>
                <button
                  type="button"
                  className="product-card__edit-btn"
                  onClick={() => openEdit(category)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="product-card__delete-btn"
                  onClick={() => handleDelete(category.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAdminCategories } from '../api/queries';
import type { Category } from '../api/types';

export const AdminCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories } = useAdminCategories();
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    iconName: '🧾',
    colorHex: '#111827',
    active: true,
  });
  const [edits, setEdits] = useState<Record<string, Partial<Category>>>({});

  const handleCreate = async () => {
    setError(null);
    try {
      await apiClient.post('/categories', newCategory);
      setNewCategory({ name: '', iconName: '🧾', colorHex: '#111827', active: true });
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpdate = async (categoryId: string) => {
    setError(null);
    try {
      await apiClient.patch(`/categories/${categoryId}`, edits[categoryId]);
      setEdits((prev) => ({ ...prev, [categoryId]: {} }));
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
    if (!file) {
      return;
    }
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
      <div className="form-grid">
        <input
          type="text"
          placeholder="Nombre"
          value={newCategory.name}
          onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
        />
        <input
          type="text"
          placeholder="Icono"
          value={newCategory.iconName}
          onChange={(event) => setNewCategory({ ...newCategory, iconName: event.target.value })}
        />
        <input
          type="text"
          placeholder="#111827"
          value={newCategory.colorHex}
          onChange={(event) => setNewCategory({ ...newCategory, colorHex: event.target.value })}
        />
        <label className="switch">
          <input
            type="checkbox"
            checked={newCategory.active}
            onChange={(event) => setNewCategory({ ...newCategory, active: event.target.checked })}
          />
          Activa
        </label>
        <button type="button" className="primary-button" onClick={handleCreate}>
          Crear
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="table">
        {rendered.map((category) => {
          const draft = edits[category.id] ?? {};
          return (
            <div key={category.id} className="table-row">
              <input
                type="text"
                value={draft.name ?? category.name}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [category.id]: { ...draft, name: event.target.value },
                  }))
                }
              />
              <input
                type="text"
                value={draft.iconName ?? category.iconName}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [category.id]: { ...draft, iconName: event.target.value },
                  }))
                }
              />
              <input
                type="text"
                value={draft.colorHex ?? category.colorHex}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [category.id]: { ...draft, colorHex: event.target.value },
                  }))
                }
              />
              <label className="switch">
                <input
                  type="checkbox"
                  checked={draft.active ?? category.active}
                  onChange={(event) =>
                    setEdits((prev) => ({
                      ...prev,
                      [category.id]: { ...draft, active: event.target.checked },
                    }))
                  }
                />
                Activa
              </label>
              <div className="row-actions">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleUpload(category.id, event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleUpdate(category.id)}
                  aria-label="Guardar"
                  title="Guardar"
                >
                  <span aria-hidden="true">💾</span>
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => handleDelete(category.id)}
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <span aria-hidden="true">🗑️</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

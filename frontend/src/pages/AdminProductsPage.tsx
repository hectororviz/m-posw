import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAdminCategories, useAdminProducts } from '../api/queries';
import type { Product } from '../api/types';

export const AdminProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories } = useAdminCategories();
  const { data: products } = useAdminProducts();
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    categoryId: '',
    colorHex: '#1f2937',
    iconName: '🍽️',
    active: true,
  });
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});

  const handleCreate = async () => {
    setError(null);
    try {
      await apiClient.post('/products', newProduct);
      setNewProduct({ name: '', price: 0, categoryId: '', colorHex: '#1f2937', iconName: '🍽️', active: true });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpdate = async (productId: string) => {
    setError(null);
    try {
      await apiClient.patch(`/products/${productId}`, edits[productId]);
      setEdits((prev) => ({ ...prev, [productId]: {} }));
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleDelete = async (productId: string) => {
    setError(null);
    try {
      await apiClient.delete(`/products/${productId}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpload = async (productId: string, file?: File | null) => {
    if (!file) {
      return;
    }
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/products/${productId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const rendered = useMemo(() => products ?? [], [products]);

  return (
    <section className="card">
      <h2>Productos</h2>
      <div className="form-grid">
        <input
          type="text"
          placeholder="Nombre"
          value={newProduct.name}
          onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
        />
        <input
          type="number"
          placeholder="Precio"
          value={newProduct.price}
          onChange={(event) => setNewProduct({ ...newProduct, price: Number(event.target.value) })}
        />
        <select
          value={newProduct.categoryId}
          onChange={(event) => setNewProduct({ ...newProduct, categoryId: event.target.value })}
        >
          <option value="">Categoría</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="#1f2937"
          value={newProduct.colorHex}
          onChange={(event) => setNewProduct({ ...newProduct, colorHex: event.target.value })}
        />
        <input
          type="text"
          placeholder="Icono"
          value={newProduct.iconName}
          onChange={(event) => setNewProduct({ ...newProduct, iconName: event.target.value })}
        />
        <label className="switch">
          <input
            type="checkbox"
            checked={newProduct.active}
            onChange={(event) => setNewProduct({ ...newProduct, active: event.target.checked })}
          />
          Activo
        </label>
        <button type="button" className="primary-button" onClick={handleCreate}>
          Crear
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="table">
        {rendered.map((product) => {
          const draft = edits[product.id] ?? {};
          return (
            <div key={product.id} className="table-row">
              <input
                type="text"
                value={draft.name ?? product.name}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [product.id]: { ...draft, name: event.target.value },
                  }))
                }
              />
              <input
                type="number"
                value={draft.price ?? product.price}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [product.id]: { ...draft, price: Number(event.target.value) },
                  }))
                }
              />
              <select
                value={draft.categoryId ?? product.categoryId}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [product.id]: { ...draft, categoryId: event.target.value },
                  }))
                }
              >
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draft.colorHex ?? product.colorHex ?? ''}
                onChange={(event) =>
                  setEdits((prev) => ({
                    ...prev,
                    [product.id]: { ...draft, colorHex: event.target.value },
                  }))
                }
              />
              <label className="switch">
                <input
                  type="checkbox"
                  checked={draft.active ?? product.active}
                  onChange={(event) =>
                    setEdits((prev) => ({
                      ...prev,
                      [product.id]: { ...draft, active: event.target.checked },
                    }))
                  }
                />
                Activo
              </label>
              <div className="row-actions">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleUpload(product.id, event.target.files?.[0])}
                />
                <button type="button" className="secondary-button" onClick={() => handleUpdate(product.id)}>
                  Guardar
                </button>
                <button type="button" className="ghost-button" onClick={() => handleDelete(product.id)}>
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

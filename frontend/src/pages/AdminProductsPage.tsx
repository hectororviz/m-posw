import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useAdminCategories, useAdminProducts, useRawMaterials } from '../api/queries';
import type { Product, ProductType } from '../api/types';

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  SIMPLE: 'Simple',
  RAW_MATERIAL: 'Materia prima',
  COMPOSITE: 'Compuesto',
};

const typeBadgeClass = (type: ProductType): string => {
  if (type === 'RAW_MATERIAL') return 'badge badge-neutral';
  if (type === 'COMPOSITE') return 'badge badge-info';
  return 'badge badge-success';
};

interface IngredientInput {
  rawMaterialId: string;
  quantity: string;
}

interface ProductForm {
  name: string;
  price: string;
  categoryId: string;
  iconName: string;
  active: boolean;
  type: ProductType;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  price: '',
  categoryId: '',
  iconName: '',
  active: true,
  type: 'SIMPLE',
};

export const AdminProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories } = useAdminCategories();
  const { data: products } = useAdminProducts();
  const { data: rawMaterials } = useRawMaterials();
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [formIngredients, setFormIngredients] = useState<IngredientInput[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const formatCurrencyInput = (value: number) => {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormIngredients([]);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: String(product.price),
      categoryId: product.categoryId,
      iconName: product.iconName ?? '',
      active: product.active,
      type: product.type,
    });
    setFormIngredients(
      product.recipeIngredients?.map(ri => ({
        rawMaterialId: ri.rawMaterialId,
        quantity: String(ri.quantity),
      })) || [],
    );
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleSave = async () => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        price: parseCurrencyInput(form.price),
        categoryId: form.type === 'RAW_MATERIAL' ? categories?.[0]?.id : form.categoryId,
        iconName: form.iconName || undefined,
        active: form.active,
        type: form.type,
      };
      if (form.type === 'COMPOSITE' && formIngredients.length > 0) {
        payload.ingredients = formIngredients
          .filter(ing => ing.rawMaterialId && ing.quantity)
          .map(ing => ({ rawMaterialId: ing.rawMaterialId, quantity: Number(ing.quantity) }));
      }
      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post('/products', payload);
      }
      closeModal();
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
    if (!file) return;
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

  const addIngredient = () => {
    setFormIngredients((prev) => [...prev, { rawMaterialId: '', quantity: '' }]);
  };

  const removeIngredient = (index: number) => {
    setFormIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string) => {
    setFormIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    );
  };

  const filtered = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') {
      result = result.filter(p => p.type === typeFilter);
    }
    return result;
  }, [products, search, typeFilter]);

  const groupedByCategory = useMemo(() => {
    const categoryLookup = new Map(categories?.map(c => [c.id, c.name]));
    const groups: { name: string; products: Product[] }[] = [];
    for (const p of filtered) {
      const catName = categoryLookup.get(p.categoryId) ?? 'Sin categoria';
      let group = groups.find(g => g.name === catName);
      if (!group) { group = { name: catName, products: [] }; groups.push(group); }
      group.products.push(p);
    }
    return groups;
  }, [filtered, categories]);

  const showPriceAndCategory = (type: ProductType) => type !== 'RAW_MATERIAL';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Productos</h2>
            <p className="page-header-subtitle">Gestiona el catalogo de productos del sistema.</p>
          </div>
          <div className="product-view-toggle">
            <button type="button" className={`product-view-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')} aria-label="Vista cards">▦</button>
            <button type="button" className={`product-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} aria-label="Vista lista">☰</button>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="stock-toolbar">
        <input
          type="text"
          className="stock-search-input"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="stock-filter-group">
          {([
            ['all', 'Todos'],
            ['SIMPLE', 'Simples'],
            ['COMPOSITE', 'Compuestos'],
            ['RAW_MATERIAL', 'Materia prima'],
          ] as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`stock-filter-chip ${typeFilter === key ? 'active' : ''}`}
              onClick={() => setTypeFilter(key as ProductType | 'all')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="fab-button-v2"
        onClick={openCreate}
        aria-label="Nuevo producto"
        title="Nuevo producto"
      >
        +
      </button>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">
              <div className="settings-field">
                <label htmlFor="prod-name">Nombre</label>
                <input id="prod-name" type="text" placeholder="Nombre del producto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="settings-field">
                <label htmlFor="prod-type">Tipo</label>
                <select id="prod-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProductType })}>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <label htmlFor="prod-category">Categoria</label>
                <select id="prod-category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Seleccionar categoria</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {showPriceAndCategory(form.type) && (
                <div className="settings-field">
                  <label htmlFor="prod-price">Precio</label>
                  <div className="price-input-wrapper">
                    <span className="price-input-symbol">$</span>
                    <input id="prod-price" type="text" inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="settings-field">
                <label htmlFor="prod-icon">Icono</label>
                <input id="prod-icon" type="text" placeholder="Emoji o texto corto" value={form.iconName} onChange={(e) => setForm({ ...form, iconName: e.target.value })} />
              </div>
              <div className="settings-field" style={{ marginBottom: 0 }}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  <span className="toggle-switch-track" />
                  Activo
                </label>
              </div>

              {form.type === 'COMPOSITE' && (
                <div className="ingredients-section">
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Ingredientes</h4>
                  {formIngredients.map((ing, index) => (
                    <div key={index} className="ingredient-row">
                      <select value={ing.rawMaterialId} onChange={(e) => updateIngredient(index, 'rawMaterialId', e.target.value)}>
                        <option value="">Seleccionar materia prima</option>
                        {rawMaterials?.map((rm) => (
                          <option key={rm.id} value={rm.id}>{rm.name} (stock: {rm.stock})</option>
                        ))}
                      </select>
                      <input type="number" step="0.0001" placeholder="Cant." value={ing.quantity} onChange={(e) => updateIngredient(index, 'quantity', e.target.value)} />
                      <button type="button" className="btn-ghost" onClick={() => removeIngredient(index)} aria-label="Eliminar ingrediente" style={{ padding: '0.4rem 0.5rem', color: '#b91c1c' }}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn-ghost" onClick={addIngredient} style={{ marginTop: '0.5rem' }}>+ Agregar ingrediente</button>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={handleSave}>{editingProduct ? 'Guardar cambios' : 'Crear producto'}</button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            {search ? 'No se encontraron productos.' : 'No hay productos todavia.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="product-list-v2">
          {groupedByCategory.map((group) => (
            <div key={group.name} className="product-list-group">
              <div className="product-list-group-head">{group.name}</div>
              {group.products.map((product) => {
                const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);
                return (
                  <div key={product.id} className={`product-list-row ${!product.active ? 'is-inactive' : ''}`}>
                    <div className="product-list-row-main">
                      <span className="product-list-row-icon">{product.iconName || imageUrl ? (imageUrl ? <img src={imageUrl} alt="" /> : null) : null}</span>
                      <span className="product-list-row-name">{product.name}</span>
                      <span className={typeBadgeClass(product.type)}>{PRODUCT_TYPE_LABELS[product.type]}</span>
                      {showPriceAndCategory(product.type) && (
                        <span className="product-list-row-price">${formatCurrencyInput(product.price)}</span>
                      )}
                    </div>
                    <div className="user-list-actions">
                      <button type="button" className="btn-ghost" onClick={() => openEdit(product)} aria-label={`Editar ${product.name}`}>✎</button>
                      <button type="button" className="btn-ghost" onClick={() => handleDelete(product.id)} aria-label={`Eliminar ${product.name}`}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="product-list">
          {groupedByCategory.map((group) => (
            <div key={group.name} className="product-category-group-v2">
              <div className="product-category-head-v2">{group.name}</div>
              <div className="product-grid-v2">
                {group.products.map((product) => {
                  const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);
                  return (
                    <div key={product.id} className={`product-card-v2 ${!product.active ? 'is-inactive' : ''}`}>
                      <div className="product-card-v2-media">
                        {imageUrl ? (
                          <img src={imageUrl} alt={product.name} />
                        ) : (
                          <span className="product-card-v2-icon">{product.iconName || '📦'}</span>
                        )}
                        <label className="product-card-v2-upload">
                          <input type="file" accept="image/*" onChange={(e) => handleUpload(product.id, e.target.files?.[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                        </label>
                      </div>
                      <div className="product-card-v2-info">
                        <span className="product-card-v2-name">{product.name}</span>
                        <span className={typeBadgeClass(product.type)}>{PRODUCT_TYPE_LABELS[product.type]}</span>
                      </div>
                      {showPriceAndCategory(product.type) && (
                        <span className="product-card-v2-price">${formatCurrencyInput(product.price)}</span>
                      )}
                      <div className="product-card-v2-actions">
                        <button type="button" className="btn-ghost" onClick={() => openEdit(product)} style={{ padding: '0.3rem 0.5rem' }} aria-label={`Editar ${product.name}`}>✎</button>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(product.id)} style={{ padding: '0.3rem 0.5rem', color: '#b91c1c' }} aria-label={`Eliminar ${product.name}`}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

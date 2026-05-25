import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useAdminCategories, useAdminProducts, useRawMaterials } from '../api/queries';
import type { Product, ProductType } from '../api/types';

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  SIMPLE: 'Producto simple',
  RAW_MATERIAL: 'Materia prima',
  COMPOSITE: 'Producto compuesto',
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
  iconName: '🍽️',
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

  const formatCurrencyInput = (value: number) => {
    return value.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });
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
      iconName: product.iconName ?? '🍽️',
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
        iconName: form.iconName,
        active: form.active,
        type: form.type,
      };

      if (form.type === 'COMPOSITE' && formIngredients.length > 0) {
        payload.ingredients = formIngredients
          .filter(ing => ing.rawMaterialId && ing.quantity)
          .map(ing => ({
            rawMaterialId: ing.rawMaterialId,
            quantity: Number(ing.quantity),
          }));
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

  const rendered = useMemo(() => {
    if (!products) return [];
    const categoryLookup = new Map(categories?.map((category) => [category.id, category.name]));

    const getPriority = (product: Product): number => {
      const typeOrder: Record<ProductType, number> = {
        SIMPLE: 0,
        COMPOSITE: 1,
        RAW_MATERIAL: 2,
      };
      return (product.active ? 0 : 3) + typeOrder[product.type];
    };

    return [...products].sort((a, b) => {
      const categoryA = categoryLookup.get(a.categoryId) ?? '';
      const categoryB = categoryLookup.get(b.categoryId) ?? '';
      const categoryCompare = categoryA.localeCompare(categoryB, 'es', { sensitivity: 'base' });
      if (categoryCompare !== 0) return categoryCompare;
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  }, [products, categories]);

  const groupedByCategory = useMemo(() => {
    const groups: { categoryName: string; products: Product[] }[] = [];
    let currentGroup: { categoryName: string; products: Product[] } | null = null;

    for (const product of rendered) {
      const categoryName = categories?.find(c => c.id === product.categoryId)?.name ?? 'Sin categoría';
      if (!currentGroup || currentGroup.categoryName !== categoryName) {
        currentGroup = { categoryName, products: [] };
        groups.push(currentGroup);
      }
      currentGroup.products.push(product);
    }

    return groups;
  }, [rendered, categories]);

  const showPriceAndCategory = (type: ProductType) => type !== 'RAW_MATERIAL';

  return (
    <section className="card admin-products">
      <h2>Productos</h2>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className="fab-button"
        onClick={openCreate}
        aria-label="Nuevo producto"
        title="Nuevo producto"
      >
        <span aria-hidden="true">+</span>
      </button>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
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
                    placeholder="Nombre del producto"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Tipo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={form.type}
                      onChange={(event) => setForm({ ...form, type: event.target.value as ProductType })}
                    >
                      {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {form.type === 'COMPOSITE' && <span title="Producto compuesto - tiene receta">📋</span>}
                  </div>
                </div>

                <div className="field">
                  <label>Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                {showPriceAndCategory(form.type) && (
                  <div className="field">
                    <label>Precio</label>
                    <div className="price-input-wrapper">
                      <span className="price-input-symbol">$</span>
                      <input
                        type="text"
                        placeholder="Precio"
                        value={form.price}
                        onChange={(event) => setForm({ ...form, price: event.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label>Icono</label>
                  <input
                    type="text"
                    placeholder="Emoji del producto"
                    value={form.iconName}
                    onChange={(event) => setForm({ ...form, iconName: event.target.value })}
                  />
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  />
                  Activo
                </label>
              </div>

              {form.type === 'COMPOSITE' && (
                <div className="ingredients-section">
                  <h4>Ingredientes</h4>
                  {formIngredients.map((ing, index) => (
                    <div key={index} className="ingredient-row">
                      <select
                        value={ing.rawMaterialId}
                        onChange={(event) => updateIngredient(index, 'rawMaterialId', event.target.value)}
                      >
                        <option value="">Seleccionar materia prima</option>
                        {rawMaterials?.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name} (stock: {rm.stock})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Cantidad"
                        value={ing.quantity}
                        onChange={(event) => updateIngredient(index, 'quantity', event.target.value)}
                      />
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeIngredient(index)}
                        aria-label="Eliminar ingrediente"
                      >
                        <span aria-hidden="true">🗑️</span>
                      </button>
                    </div>
                  ))}
                  <button type="button" className="button secondary" onClick={addIngredient}>
                    + Agregar ingrediente
                  </button>
                </div>
              )}
            </div>
            <div className="checkout-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={handleSave}>
                {editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="product-list">
        {groupedByCategory.map((group) => (
          <div key={group.categoryName} className="product-category-group">
            <div className="product-category-header">{group.categoryName}</div>
            <div className="product-grid">
              {group.products.map((product) => {
                const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);

                return (
                  <div key={product.id} className={`product-card ${!product.active ? 'product-card--inactive' : ''}`}>
                    <div className="product-card__image">
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} />
                      ) : (
                        <span className="product-card__icon">{product.iconName || '🍽️'}</span>
                      )}
                      <label className="product-card__image-upload">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleUpload(product.id, event.target.files?.[0])}
                          className="product-card__file-input"
                        />
                      </label>
                    </div>

                    <div className="product-card__info">
                      <span className="product-card__name">
                        {product.name}
                        {showPriceAndCategory(product.type) && (
                          <span className="product-card__price"> - $ {formatCurrencyInput(product.price)}</span>
                        )}
                      </span>
                      <span className="product-card__type">
                        {PRODUCT_TYPE_LABELS[product.type]}
                        {product.type === 'COMPOSITE' && (
                          <span className="product-card__recipe"> ({product.recipeIngredients?.length || 0} ing.)</span>
                        )}
                      </span>
                    </div>

                    <div className="product-card__actions">
                      <button
                        type="button"
                        className="product-card__edit-btn"
                        onClick={() => openEdit(product)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="product-card__delete-btn"
                        onClick={() => handleDelete(product.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

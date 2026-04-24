import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
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

export const AdminProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories } = useAdminCategories();
  const { data: products } = useAdminProducts();
  const { data: rawMaterials } = useRawMaterials();
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    categoryId: '',
    iconName: '🍽️',
    active: true,
    type: 'SIMPLE' as ProductType,
  });
  const [newIngredients, setNewIngredients] = useState<IngredientInput[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});
  const [editIngredients, setEditIngredients] = useState<Record<string, IngredientInput[]>>({});

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

  const handleCreate = async () => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: newProduct.name,
        price: parseCurrencyInput(newProduct.price),
        categoryId: newProduct.type === 'RAW_MATERIAL' ? categories?.[0]?.id : newProduct.categoryId,
        iconName: newProduct.iconName,
        active: newProduct.active,
        type: newProduct.type,
      };

      // Agregar ingredientes si es COMPOSITE
      if (newProduct.type === 'COMPOSITE' && newIngredients.length > 0) {
        payload.ingredients = newIngredients
          .filter(ing => ing.rawMaterialId && ing.quantity)
          .map(ing => ({
            rawMaterialId: ing.rawMaterialId,
            quantity: Number(ing.quantity),
          }));
      }

      await apiClient.post('/products', payload);
      setNewProduct({ name: '', price: '', categoryId: '', iconName: '🍽️', active: true, type: 'SIMPLE' });
      setNewIngredients([]);
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleUpdate = async (productId: string) => {
    setError(null);
    try {
      const product = products?.find(p => p.id === productId);
      const draft = edits[productId] ?? {};
      const ingredients = editIngredients[productId];
      const payload: Record<string, unknown> = { ...draft };

      // Determinar el tipo actual (considerando el draft y el producto original)
      const currentType = draft.type ?? product?.type;

      // Agregar ingredientes si es COMPOSITE y se editaron
      if (ingredients !== undefined && currentType === 'COMPOSITE') {
        payload.ingredients = ingredients
          .filter(ing => ing.rawMaterialId && ing.quantity)
          .map(ing => ({
            rawMaterialId: ing.rawMaterialId,
            quantity: Number(ing.quantity),
          }));
      }

      await apiClient.patch(`/products/${productId}`, payload);
      setEdits((prev) => ({ ...prev, [productId]: {} }));
      setEditIngredients((prev) => ({ ...prev, [productId]: undefined as unknown as IngredientInput[] }));
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

  const addIngredient = (productId?: string) => {
    if (productId) {
      setEditIngredients((prev) => ({
        ...prev,
        [productId]: [...(prev[productId] || []), { rawMaterialId: '', quantity: '' }],
      }));
    } else {
      setNewIngredients((prev) => [...prev, { rawMaterialId: '', quantity: '' }]);
    }
  };

  const removeIngredient = (index: number, productId?: string) => {
    if (productId) {
      setEditIngredients((prev) => ({
        ...prev,
        [productId]: prev[productId]?.filter((_, i) => i !== index) || [],
      }));
    } else {
      setNewIngredients((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string, productId?: string) => {
    if (productId) {
      setEditIngredients((prev) => ({
        ...prev,
        [productId]: prev[productId]?.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)) || [],
      }));
    } else {
      setNewIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
    }
  };

  const rendered = useMemo(() => {
    if (!products) {
      return [];
    }
    const categoryLookup = new Map(categories?.map((category) => [category.id, category.name]));
    return [...products].sort((a, b) => {
      const categoryA = categoryLookup.get(a.categoryId) ?? '';
      const categoryB = categoryLookup.get(b.categoryId) ?? '';
      const categoryCompare = categoryA.localeCompare(categoryB, 'es', { sensitivity: 'base' });
      if (categoryCompare !== 0) {
        return categoryCompare;
      }
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  }, [products, categories]);

  const showPriceAndCategory = (type: ProductType) => type !== 'RAW_MATERIAL';

  return (
    <section className="card admin-products">
      <h2>Productos</h2>
      
      {/* Formulario de creación */}
      <div className="product-form-section">
        <h3>Nuevo Producto</h3>
        <div className="product-form-row">
          <input
            type="text"
            placeholder="Nombre"
            value={newProduct.name}
            onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
          />
          
          <select
            value={newProduct.type}
            onChange={(event) => setNewProduct({ ...newProduct, type: event.target.value as ProductType })}
          >
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {showPriceAndCategory(newProduct.type) && (
            <>
              <div className="price-input-wrapper">
                <span className="price-input-symbol">$</span>
                <input
                  type="text"
                  placeholder="Precio"
                  value={newProduct.price}
                  onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
                />
              </div>
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
            </>
          )}

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
          <button type="button" className="icon-button primary-button" onClick={handleCreate} aria-label="Crear" title="Crear">
            <span aria-hidden="true">+</span>
          </button>
        </div>

        {/* Sección de ingredientes para COMPOSITE */}
        {newProduct.type === 'COMPOSITE' && (
          <div className="ingredients-section">
            <h4>Ingredientes</h4>
            {newIngredients.map((ing, index) => (
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
            <button type="button" className="button secondary" onClick={() => addIngredient()}>
              + Agregar ingrediente
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Tabla de productos */}
      <div className="product-table">
        <div className="product-table-header">
          <span>Nombre</span>
          <span>Tipo</span>
          <span>Precio</span>
          <span>Categoría</span>
          <span>Imagen</span>
          <span>Activo</span>
          <span>Acciones</span>
        </div>
        {rendered.map((product) => {
          const draft = edits[product.id] ?? {};
          const currentType = draft.type ?? product.type;
          const ingredients = editIngredients[product.id] !== undefined
            ? editIngredients[product.id]
            : (product.recipeIngredients?.map(ri => ({
                rawMaterialId: ri.rawMaterialId,
                quantity: String(ri.quantity),
              })) || []);

          return (
            <div key={product.id} className="product-table-row-wrapper">
              <div className="product-table-row">
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
                
                <select
                  value={currentType}
                  onChange={(event) =>
                    setEdits((prev) => ({
                      ...prev,
                      [product.id]: { ...draft, type: event.target.value as ProductType },
                    }))
                  }
                >
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {showPriceAndCategory(currentType) && (
                  <>
                    <div className="price-input-wrapper">
                      <span className="price-input-symbol">$</span>
                      <input
                        type="text"
                        value={formatCurrencyInput(draft.price ?? product.price)}
                        onChange={(event) =>
                          setEdits((prev) => ({
                            ...prev,
                            [product.id]: { ...draft, price: parseCurrencyInput(event.target.value) },
                          }))
                        }
                      />
                    </div>
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
                  </>
                )}
                
                {!showPriceAndCategory(currentType) && (
                  <>
                    <span>-</span>
                    <span>-</span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleUpload(product.id, event.target.files?.[0])}
                />
                <label className="switch switch-sm">
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
                </label>
                <div className="product-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleUpdate(product.id)}
                    aria-label="Guardar"
                    title="Guardar"
                  >
                    <span aria-hidden="true">💾</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => handleDelete(product.id)}
                    aria-label="Eliminar"
                    title="Eliminar"
                  >
                    <span aria-hidden="true">🗑️</span>
                  </button>
                </div>
              </div>

              {/* Sección de ingredientes editable para COMPOSITE */}
              {currentType === 'COMPOSITE' && (
                <div className="ingredients-edit-section">
                  <h5>Ingredientes</h5>
                  {ingredients?.map((ing, index) => (
                      <div key={index} className="ingredient-row">
                        <select
                          value={ing.rawMaterialId}
                          onChange={(event) => updateIngredient(index, 'rawMaterialId', event.target.value, product.id)}
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
                          onChange={(event) => updateIngredient(index, 'quantity', event.target.value, product.id)}
                        />
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => removeIngredient(index, product.id)}
                          aria-label="Eliminar ingrediente"
                        >
                          <span aria-hidden="true">🗑️</span>
                        </button>
                      </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => addIngredient(product.id)}
                  >
                    + Agregar ingrediente
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

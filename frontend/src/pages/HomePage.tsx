import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, buildImageUrl } from '../api/client';
import { useCategories, useProductsByCategory } from '../api/queries';
import type { Category } from '../api/types';
import { AppLayout } from '../components/AppLayout';
import { CartPanel } from '../components/CartPanel';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/ToastProvider';
import type { Product } from '../api/types';

const prefetchCategories = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.prefetchQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>('/categories');
      return response.data;
    },
  });
};

export const HomePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { addItem } = useCart();
  const { pushToast } = useToast();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const { data: products, isLoading } = useProductsByCategory(activeCategoryId ?? undefined);

  useEffect(() => {
    void prefetchCategories(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const handleAddItem = (product: Product) => {
    if (product.stock === 0) {
      pushToast('Sin stock disponible.', 'error');
    }
    addItem(product);
  };

  return (
    <AppLayout>
      <div className="pos-layout">
        <div className="pos-main">
          <div className="pos-category-bar">
            {categories?.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pos-category-chip ${cat.id === activeCategoryId ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(cat.id)}
                style={cat.id === activeCategoryId ? { background: cat.colorHex || 'var(--accent-color)', color: '#fff' } : undefined}
              >
                {cat.iconName && <span className="pos-category-emoji">{cat.iconName}</span>}
                {cat.name}
              </button>
            ))}
          </div>

          <div className="pos-products">
            {isLoading && <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Cargando productos...</p>}
            {!isLoading && products && products.length === 0 && (
              <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>Sin productos en esta categoria.</p>
            )}
            <div className="pos-product-grid">
              {products?.map((product) => {
                const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);
                const iconName = product.iconName?.trim() || '📦';
                const showStockBadge = product.stock >= 1 && product.stock <= 10;
                return (
                  <button
                    type="button"
                    key={product.id}
                    className={`pos-product-card ${product.stock === 0 ? 'is-out' : ''}`}
                    onClick={() => handleAddItem(product)}
                    aria-label={`Agregar ${product.name}`}
                  >
                    <div className="pos-product-media" style={{ background: product.colorHex || '#1f2937' }}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} loading="lazy" />
                      ) : (
                        <span className="pos-product-icon" aria-hidden="true">{iconName}</span>
                      )}
                      <span className="pos-product-price">
                        ${product.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {showStockBadge && (
                        <span className="pos-product-stock">{product.stock}</span>
                      )}
                    </div>
                    <span className="pos-product-name">{product.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <CartPanel showMovementButton />
      </div>
    </AppLayout>
  );
};

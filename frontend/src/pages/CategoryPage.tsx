import { useParams } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import { useCategories, useProductsByCategory } from '../api/queries';
import { AppLayout } from '../components/AppLayout';
import { CartPanel } from '../components/CartPanel';
import { CategoryHeader } from '../components/CategoryHeader';
import { useCart } from '../context/CartContext';

export const CategoryPage: React.FC = () => {
  const { id } = useParams();
  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProductsByCategory(id);
  const { addItem } = useCart();
  const category = categories?.find((item) => item.id === id);

  return (
    <AppLayout>
      <CategoryHeader title={category?.name ?? 'Productos'} />
      <div className="two-column category-layout">
        <section>
          {isLoading && <p>Cargando productos...</p>}
          <div className="grid product-grid">
            {products?.map((product) => {
              const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);
              const iconName = product.iconName?.trim() || 'local_cafe';
              return (
                <button
                  type="button"
                  key={product.id}
                  className="card product-card"
                  onClick={() => addItem(product)}
                >
                  <div className="product-media" style={{ background: product.colorHex || '#1f2937' }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} />
                    ) : (
                      <span className="material-symbols-rounded product-icon" aria-hidden="true">
                        {iconName}
                      </span>
                    )}
                    <span className="price-badge">
                      $
                      {product.price.toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <CartPanel />
      </div>
    </AppLayout>
  );
};

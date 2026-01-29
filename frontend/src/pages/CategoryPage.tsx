import { Link, useParams } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import { useCategories, useProductsByCategory } from '../api/queries';
import { Layout } from '../components/Layout';
import { useCart } from '../context/CartContext';

export const CategoryPage: React.FC = () => {
  const { id } = useParams();
  const { data: categories } = useCategories();
  const { data: products, isLoading } = useProductsByCategory(id);
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const category = categories?.find((item) => item.id === id);

  return (
    <Layout title={category?.name ?? 'Productos'}>
      <div className="two-column">
        <section>
          {isLoading && <p>Cargando productos...</p>}
          <div className="grid">
            {products?.map((product) => {
              const imageUrl = buildImageUrl(product.imagePath, product.imageUpdatedAt);
              return (
                <button
                  type="button"
                  key={product.id}
                  className="card product-card"
                  onClick={() => addItem(product)}
                >
                  <div className="card-header" style={{ background: product.colorHex || '#1f2937' }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} />
                    ) : (
                      <span className="emoji">{product.iconName || '🍽️'}</span>
                    )}
                  </div>
                  <div className="card-body">
                    <h3>{product.name}</h3>
                    <p className="price">${product.price.toFixed(2)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="cart-panel">
          <h2>Carrito</h2>
          {items.length === 0 && <p>Seleccioná productos para empezar.</p>}
          <ul>
            {items.map((item) => (
              <li key={item.product.id}>
                <div>
                  <strong>{item.product.name}</strong>
                  <span>${item.product.price.toFixed(2)}</span>
                </div>
                <div className="cart-controls">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updateQuantity(item.product.id, Number(event.target.value) || 1)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button type="button" className="ghost-button" onClick={() => removeItem(item.product.id)}>
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-footer">
            <Link to="/checkout" className="primary-button">
              Ir a cobrar
            </Link>
          </div>
        </aside>
      </div>
    </Layout>
  );
};

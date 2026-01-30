import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const STORAGE_KEY = 'pos-cart-collapsed';

const formatAmount = (amount: number) =>
  `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CartPanel: React.FC = () => {
  const { items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [items],
  );

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <aside className={`cart-panel ${isCollapsed ? 'is-collapsed' : ''}`}>
      <div className="cart-panel__header">
        {!isCollapsed && <h2>Carrito</h2>}
        <button
          type="button"
          className="icon-button cart-collapse-button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? 'Expandir carrito' : 'Colapsar carrito'}
        >
          <span aria-hidden="true">{isCollapsed ? '←' : '→'}</span>
        </button>
      </div>
      {!isCollapsed && (
        <>
          <div className="cart-panel__content">
            {items.length === 0 && <p className="empty-cart">Seleccioná productos para empezar.</p>}
            {items.length > 0 && (
              <ul className="cart-items">
                {items.map((item) => (
                  <li key={item.product.id} className="cart-item">
                    <div className="cart-item__info">
                      <strong>{item.product.name}</strong>
                      <span>{formatAmount(item.product.price)}</span>
                    </div>
                    <div className="cart-controls">
                      <button
                        type="button"
                        className="quantity-button"
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
                        className="quantity-button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ghost-button remove-button"
                        onClick={() => removeItem(item.product.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="cart-panel__footer">
            <div className="cart-total">
              <span>TOTAL</span>
              <strong>{formatAmount(total)}</strong>
            </div>
            <button
              type="button"
              className="primary-button cart-checkout-button"
              onClick={() => navigate('/checkout/payment')}
              disabled={items.length === 0}
            >
              Cobrar
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

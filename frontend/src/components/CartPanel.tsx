import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';
import { useCart } from '../context/CartContext';
import { useToast } from './ToastProvider';
import { CheckoutModal } from './CheckoutModal';

const STORAGE_KEY = 'pos-cart-collapsed';

const formatAmount = (amount: number) =>
  `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_IN_REASONS = ['Apertura de Caja', 'Otro'];
const DEFAULT_OUT_REASONS = ['Retiro de caja', 'Otro'];

interface CartPanelProps {
  showMovementButton?: boolean;
}

export const CartPanel: React.FC<CartPanelProps> = ({ showMovementButton }) => {
  const { items, updateQuantity, removeItem } = useCart();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { pushToast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Estados para el modal de movimientos
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);

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

  const getAvailableReasons = (type: 'ENTRADA' | 'SALIDA') => {
    const defaultReasons = type === 'ENTRADA' ? DEFAULT_IN_REASONS : DEFAULT_OUT_REASONS;
    const customReasons = type === 'ENTRADA'
      ? (settings?.movementInReasons ?? [])
      : (settings?.movementOutReasons ?? []);
    const allReasons = [...defaultReasons];
    customReasons.forEach((reason) => {
      if (!allReasons.includes(reason)) {
        allReasons.push(reason);
      }
    });
    return allReasons;
  };

  const handleOpenMovement = () => {
    setMovementType('ENTRADA');
    setMovementAmount('');
    const reasons = getAvailableReasons('ENTRADA');
    setMovementReason(reasons[0] || '');
    setMovementDescription('');
    setIsMovementOpen(true);
  };

  const handleCloseMovement = () => {
    setIsMovementOpen(false);
  };

  const isMovementValid = () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    const description = movementDescription.trim();
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) {
      return false;
    }
    if (reason === 'Otro' && description.length === 0) {
      return false;
    }
    return true;
  };

  const handleSaveMovement = async () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    const description = movementDescription.trim();
    
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) {
      return;
    }
    if (reason === 'Otro' && description.length === 0) {
      pushToast('La descripción es obligatoria cuando el motivo es "Otro"', 'error');
      return;
    }

    setIsSavingMovement(true);
    try {
      await apiClient.post('/sales/manual-movements', {
        type: movementType,
        amount,
        reason,
        description: description || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['manual-movements'] });
      pushToast('Movimiento agregado correctamente.', 'success');
      setIsMovementOpen(false);
    } catch (error) {
      pushToast(normalizeApiError(error), 'error');
    } finally {
      setIsSavingMovement(false);
    }
  };

  return (
    <>
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
                onClick={() => setIsCheckoutOpen(true)}
                disabled={items.length === 0}
              >
                Cobrar
              </button>
              {showMovementButton && (
                <button
                  type="button"
                  className="movement-button"
                  onClick={handleOpenMovement}
                >
                  Movimientos
                </button>
              )}
            </div>
          </>
        )}
      </aside>
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
      
      {/* Modal de Movimientos */}
      {isMovementOpen && (
        <div className="modal-backdrop" onClick={handleCloseMovement} role="presentation">
          <div
            className="modal admin-sales__movement-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Agregar movimiento</h2>
              <button type="button" className="icon-button" onClick={handleCloseMovement} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body admin-sales__movement-form">
              <div className="admin-sales__movement-type-row">
                <fieldset className="admin-sales__movement-type" aria-label="Tipo de movimiento">
                  <label>
                    <input
                      type="radio"
                      name="movement-type"
                      value="ENTRADA"
                      checked={movementType === 'ENTRADA'}
                      onChange={() => {
                        setMovementType('ENTRADA');
                        const reasons = getAvailableReasons('ENTRADA');
                        setMovementReason(reasons[0] || '');
                        setMovementDescription('');
                      }}
                    />
                    Entrada
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="movement-type"
                      value="SALIDA"
                      checked={movementType === 'SALIDA'}
                      onChange={() => {
                        setMovementType('SALIDA');
                        const reasons = getAvailableReasons('SALIDA');
                        setMovementReason(reasons[0] || '');
                        setMovementDescription('');
                      }}
                    />
                    Salida
                  </label>
                </fieldset>
                <label className="input-field movement-reason-field">
                  Motivo
                  <select
                    value={movementReason}
                    onChange={(e) => {
                      setMovementReason(e.target.value);
                      setMovementDescription('');
                    }}
                    className="movement-reason-select"
                  >
                    {getAvailableReasons(movementType).map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-sales__movement-main">
                <label className="input-field">
                  Monto
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={movementAmount}
                    onChange={(event) => setMovementAmount(event.target.value)}
                  />
                </label>
              </div>
              {movementReason === 'Otro' && (
                <label className="input-field">
                  Descripción (obligatoria)
                  <textarea
                    rows={3}
                    placeholder="Describí el motivo"
                    value={movementDescription}
                    onChange={(event) => setMovementDescription(event.target.value)}
                    required
                  />
                </label>
              )}
              {movementReason !== 'Otro' && (
                <label className="input-field">
                  Descripción (opcional)
                  <textarea
                    rows={2}
                    placeholder="Descripción adicional (opcional)"
                    value={movementDescription}
                    onChange={(event) => setMovementDescription(event.target.value)}
                  />
                </label>
              )}
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={handleCloseMovement}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSaveMovement}
                  disabled={!isMovementValid() || isSavingMovement}
                >
                  {isSavingMovement ? 'Guardando...' : 'Guardar movimiento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

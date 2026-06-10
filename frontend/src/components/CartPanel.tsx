import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';
import { useCart } from '../context/CartContext';
import { useToast } from './ToastProvider';
import { CheckoutModal } from './CheckoutModal';
import { SocioQrModal } from './SocioQrModal';

const STORAGE_KEY = 'pos-cart-collapsed';

const formatAmount = (amount: number) =>
  `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_IN_REASONS = ['Apertura de Caja', 'Otro'];
const DEFAULT_OUT_REASONS = ['Retiro de caja', 'Otro'];

interface CartPanelProps {
  showMovementButton?: boolean;
}

export const CartPanel: React.FC<CartPanelProps> = ({ showMovementButton }) => {
  const { items, discounts, socioData, updateQuantity, removeItem, setSocioData, removeDiscounts } = useCart();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { pushToast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [items],
  );
  const discountTotal = useMemo(
    () => discounts.reduce((acc, d) => acc + d.monto, 0),
    [discounts],
  );
  const total = subtotal - discountTotal;

  const handleApplyDiscounts = (qrData: any) => {
    const available = qrData.beneficios.filter((b: any) => b.disponible) as any[];
    setSocioData({
      socioId: qrData.socio.id || 0,
      uuid: '',
      nombre: qrData.socio.nombre,
      nroSocio: qrData.socio.nroSocio,
      beneficios: available.map((b: any) => ({
        id: b.id,
        categoriaId: b.categoriaId,
        categoriaNombre: b.categoriaNombre,
        productoId: b.productoId,
        productoNombre: b.productoNombre,
        porcentaje: b.porcentaje,
        descuentoMaximo: b.descuentoMaximo,
        limiteDiario: b.limiteDiario,
      })),
    });
    setIsQrOpen(false);
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const getAvailableReasons = (type: 'ENTRADA' | 'SALIDA') => {
    const defaults = type === 'ENTRADA' ? DEFAULT_IN_REASONS : DEFAULT_OUT_REASONS;
    const custom = type === 'ENTRADA' ? (settings?.movementInReasons ?? []) : (settings?.movementOutReasons ?? []);
    return [...new Set([...defaults, ...custom])];
  };

  const handleOpenMovement = () => {
    setMovementType('ENTRADA');
    setMovementAmount('');
    setMovementReason(getAvailableReasons('ENTRADA')[0] || '');
    setMovementDescription('');
    setIsMovementOpen(true);
  };

  const isMovementValid = () => {
    const a = Number(movementAmount);
    const r = movementReason.trim();
    if (!Number.isFinite(a) || a <= 0 || r.length === 0) return false;
    if (r === 'Otro' && movementDescription.trim().length === 0) return false;
    return true;
  };

  const handleSaveMovement = async () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    const description = movementDescription.trim();
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) return;
    if (reason === 'Otro' && description.length === 0) { pushToast('La descripcion es obligatoria', 'error'); return; }
    setIsSavingMovement(true);
    try {
      await apiClient.post('/sales/manual-movements', { type: movementType, amount, reason, description: description || undefined });
      await queryClient.invalidateQueries({ queryKey: ['manual-movements'] });
      pushToast('Movimiento agregado.', 'success');
      setIsMovementOpen(false);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setIsSavingMovement(false);
    }
  };

  return (
    <>
      <aside className={`cart-panel ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="cart-panel__header">
          {!isCollapsed && <h2>Carrito</h2>}
          <button type="button" className="icon-button cart-collapse-button" onClick={toggleCollapsed} aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}>
            <span aria-hidden="true">{isCollapsed ? '←' : '→'}</span>
          </button>
        </div>
        {!isCollapsed && (
          <>
            <div className="cart-panel__content">
              {items.length === 0 && discounts.length === 0 && <p className="empty-cart">Selecciona productos para empezar.</p>}
              {items.length > 0 && (
                <ul className="cart-items">
                  {items.map((item) => (
                    <li key={item.product.id} className="cart-item">
                      <div className="cart-item__info">
                        <span className="cart-item__name">{item.product.name}</span>
                        <span className="cart-item__unit">{formatAmount(item.product.price)}</span>
                      </div>
                      <div className="cart-item__stepper">
                        <button type="button" className="cart-stepper-btn" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>−</button>
                        <span className="cart-stepper-value">{item.quantity}</span>
                        <button type="button" className="cart-stepper-btn" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>+</button>
                        <button type="button" className="cart-item-remove" onClick={() => removeItem(item.product.id)} aria-label={`Quitar ${item.product.name}`}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {discounts.length > 0 && (
                <ul className="cart-items" style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  {discounts.map((d, i) => (
                    <li key={i} className="cart-item" style={{ color: 'var(--color-success)' }}>
                      <div className="cart-item__info" style={{ flex: 1 }}>
                        <span className="cart-item__name" style={{ fontSize: '0.85rem' }}>Descuento socio - {d.categoriaNombre} ({d.porcentaje}%)</span>
                        <span className="cart-item__unit">-{formatAmount(d.monto)}</span>
                      </div>
                    </li>
                  ))}
                  {socioData && (
                    <li className="cart-item" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Socio: {socioData.nombre} (#{socioData.nroSocio})</span>
                      <button type="button" className="cart-item-remove" onClick={removeDiscounts} title="Quitar descuentos">×</button>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="cart-panel__footer">
              <div className="cart-total">
                <span>TOTAL</span>
                <strong>{formatAmount(total)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {items.length > 0 && (settings?.enableSociosModule ?? true) && (
                  <button type="button" className="cart-checkout-btn" style={{ flex: 1 }} onClick={() => setIsQrOpen(true)}>
                    QR
                  </button>
                )}
                <button type="button" className="cart-checkout-btn" style={{ flex: 1 }} onClick={() => setIsCheckoutOpen(true)} disabled={items.length === 0}>
                  Cobrar
                </button>
                {showMovementButton && (
                  <button type="button" className="cart-movement-btn" onClick={handleOpenMovement}>
                    Movimientos
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
      {isQrOpen && (
        <SocioQrModal
          onApplyDiscounts={handleApplyDiscounts}
          onClose={() => setIsQrOpen(false)}
        />
      )}

      {isMovementOpen && (
        <div className="modal-backdrop" onClick={() => setIsMovementOpen(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Nuevo movimiento</h3><button className="icon-button" onClick={() => setIsMovementOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="settings-field">
                <label>Tipo</label>
                <fieldset className="admin-sales__movement-type" style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: '1rem' }}>
                  <label className="toggle-switch"><input type="radio" name="cmov-type" value="ENTRADA" checked={movementType === 'ENTRADA'} onChange={() => { setMovementType('ENTRADA'); setMovementReason(getAvailableReasons('ENTRADA')[0] || ''); }} /><span className="toggle-switch-track" />Entrada</label>
                  <label className="toggle-switch"><input type="radio" name="cmov-type" value="SALIDA" checked={movementType === 'SALIDA'} onChange={() => { setMovementType('SALIDA'); setMovementReason(getAvailableReasons('SALIDA')[0] || ''); }} /><span className="toggle-switch-track" />Salida</label>
                </fieldset>
              </div>
              <div className="settings-field">
                <label>Motivo</label>
                <select value={movementReason} onChange={(e) => { setMovementReason(e.target.value); setMovementDescription(''); }}>
                  {getAvailableReasons(movementType).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="settings-field">
                <label>Monto</label>
                <input type="text" inputMode="decimal" placeholder="0" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
              </div>
              <div className="settings-field">
                <label>{movementReason === 'Otro' ? 'Descripcion (obligatoria)' : 'Descripcion (opcional)'}</label>
                <textarea rows={movementReason === 'Otro' ? 3 : 2} placeholder="Descripcion" value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setIsMovementOpen(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleSaveMovement} disabled={!isMovementValid() || isSavingMovement}>{isSavingMovement ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

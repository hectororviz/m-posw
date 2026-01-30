import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';
import type { PaymentMethod } from '../api/types';
import { AppLayout } from '../components/AppLayout';
import { useToast } from '../components/ToastProvider';
import { useCart } from '../context/CartContext';

type CheckoutStep = 'SELECT_METHOD' | 'CASH';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const roundToCurrency = (value: number) => Math.round(value * 100) / 100;

export const CheckoutPaymentPage: React.FC = () => {
  const { items, clear } = useCart();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('SELECT_METHOD');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const total = useMemo(
    () => roundToCurrency(items.reduce((acc, item) => acc + item.product.price * item.quantity, 0)),
    [items],
  );

  const receivedAmount = roundToCurrency(Number(cashReceived || 0));
  const changeAmount = roundToCurrency(receivedAmount - total);
  const isCashValid = items.length > 0 && receivedAmount >= total;

  if (items.length === 0) {
    return (
      <AppLayout title="Checkout">
        <p>No hay productos en el carrito.</p>
      </AppLayout>
    );
  }

  const handleCashConfirm = async () => {
    if (!isCashValid) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.post('/sales/cash', {
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        total,
        paymentMethod: 'CASH' as PaymentMethod,
        cashReceived: receivedAmount,
        changeAmount,
      });
      pushToast('Venta registrada', 'success');
      clear();
      navigate('/');
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartQr = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.post<{ saleId: string }>('/sales/qr', {
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        total,
        paymentMethod: 'MP_QR' as PaymentMethod,
      });
      navigate(`/checkout/qr/${response.data.saleId}`);
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Checkout">
      {step === 'SELECT_METHOD' && (
        <div className="checkout-step">
          <p className="checkout-total">
            Total: <strong>{formatCurrency(total)}</strong>
          </p>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
          <div className="checkout-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setStep('CASH')}
              disabled={isSubmitting}
            >
              Efectivo
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleStartQr}
              disabled={isSubmitting}
            >
              QR
            </button>
          </div>
        </div>
      )}
      {step === 'CASH' && (
        <div className="checkout-step">
          <p className="checkout-total">
            Total: <strong>{formatCurrency(total)}</strong>
          </p>
          <label className="input-field">
            Monto recibido
            <input
              type="number"
              min={0}
              step={0.01}
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
            />
          </label>
          <div className="cash-summary">
            {receivedAmount < total ? (
              <p className="error-text">
                Falta: {formatCurrency(roundToCurrency(total - receivedAmount))}
              </p>
            ) : (
              <p>Vuelto: {formatCurrency(changeAmount)}</p>
            )}
          </div>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
          <div className="checkout-actions">
            <button type="button" className="ghost-button" onClick={() => setStep('SELECT_METHOD')}>
              Volver
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleCashConfirm}
              disabled={!isCashValid || isSubmitting}
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

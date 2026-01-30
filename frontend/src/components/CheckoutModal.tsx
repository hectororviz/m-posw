import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, normalizeApiError } from '../api/client';
import type { PaymentMethod, SaleStatus } from '../api/types';
import { useCart } from '../context/CartContext';
import { useToast } from './ToastProvider';

type CheckoutStep = 'SELECT_METHOD' | 'CASH' | 'QR_WAIT';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const roundToCurrency = (value: number) => Math.round(value * 100) / 100;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { items, clear } = useCart();
  const { pushToast } = useToast();
  const [step, setStep] = useState<CheckoutStep>('SELECT_METHOD');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<SaleStatus | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);
  const qrRequestRef = useRef<AbortController | null>(null);
  const qrPollRef = useRef<number | null>(null);
  const qrTimerRef = useRef<number | null>(null);
  const pollingInFlight = useRef(false);

  const total = useMemo(
    () => roundToCurrency(items.reduce((acc, item) => acc + item.product.price * item.quantity, 0)),
    [items],
  );

  const receivedAmount = roundToCurrency(Number(cashReceived || 0));
  const changeAmount = roundToCurrency(receivedAmount - total);
  const isCashValid = items.length > 0 && receivedAmount >= total;

  const resetState = () => {
    setStep('SELECT_METHOD');
    setCashReceived('');
    setIsSubmitting(false);
    setSaleId(null);
    setQrStatus(null);
    setQrMessage(null);
    setTimeLeft(120);
    setQrLoading(false);
    setQrError(null);
    setCashError(null);
  };

  const clearQrTimers = () => {
    if (qrPollRef.current) {
      window.clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
    if (qrTimerRef.current) {
      window.clearInterval(qrTimerRef.current);
      qrTimerRef.current = null;
    }
  };

  const abortQrRequest = () => {
    if (qrRequestRef.current) {
      qrRequestRef.current.abort();
      qrRequestRef.current = null;
    }
  };

  const cancelQrSale = async (currentSaleId: string) => {
    try {
      await apiClient.post(`/sales/${currentSaleId}/cancel`);
    } catch (error) {
      setQrError(normalizeApiError(error));
    }
  };

  const handleClose = useCallback(() => {
    abortQrRequest();
    clearQrTimers();
    if (saleId && step === 'QR_WAIT' && qrStatus === 'PENDING') {
      void cancelQrSale(saleId);
    }
    onClose();
  }, [saleId, step, qrStatus, onClose]);

  useEffect(() => {
    if (!isOpen) {
      abortQrRequest();
      clearQrTimers();
      resetState();
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose, isOpen]);

  useEffect(() => {
    return () => {
      abortQrRequest();
      clearQrTimers();
    };
  }, []);

  useEffect(() => {
    if (step !== 'QR_WAIT' || !saleId) {
      return;
    }
    setTimeLeft(120);
    if (!qrTimerRef.current) {
      qrTimerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => {
      if (qrTimerRef.current) {
        window.clearInterval(qrTimerRef.current);
        qrTimerRef.current = null;
      }
    };
  }, [step, saleId]);

  useEffect(() => {
    if (step !== 'QR_WAIT' || !saleId) {
      return;
    }
    if (qrPollRef.current) {
      return;
    }
    qrPollRef.current = window.setInterval(async () => {
      if (pollingInFlight.current || timeLeft <= 0) {
        return;
      }
      pollingInFlight.current = true;
      try {
        const response = await apiClient.get<{ status: SaleStatus }>(`/sales/${saleId}/status`);
        const status = response.data.status;
        setQrStatus(status);
        if (status === 'APPROVED') {
          clearQrTimers();
          pushToast('Pago confirmado', 'success');
          clear();
          handleClose();
        } else if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') {
          clearQrTimers();
          setQrMessage(
            status === 'REJECTED'
              ? 'Pago rechazado.'
              : status === 'EXPIRED'
                ? 'El pago expiró.'
                : 'Pago cancelado.',
          );
        }
      } catch (error) {
        setQrError(normalizeApiError(error));
        clearQrTimers();
      } finally {
        pollingInFlight.current = false;
      }
    }, 2000);
  }, [step, saleId, timeLeft, clear, pushToast, handleClose]);

  useEffect(() => {
    if (step !== 'QR_WAIT' || !saleId) {
      return;
    }
    if (timeLeft === 0 && qrStatus !== 'APPROVED') {
      clearQrTimers();
      setQrMessage('Tiempo agotado.');
    }
  }, [timeLeft, step, saleId, qrStatus]);

  useEffect(() => {
    if (step !== 'QR_WAIT' || saleId || items.length === 0) {
      return;
    }
    const createQrSale = async () => {
      setQrLoading(true);
      setQrError(null);
      setQrMessage(null);
      const controller = new AbortController();
      qrRequestRef.current = controller;
      try {
        const response = await apiClient.post<{ saleId: string; status: SaleStatus }>(
          '/sales/qr',
          {
            items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
            total,
            paymentMethod: 'MP_QR' as PaymentMethod,
          },
          { signal: controller.signal },
        );
        setSaleId(response.data.saleId);
        setQrStatus(response.data.status);
      } catch (error) {
        if (!controller.signal.aborted) {
          setQrError(normalizeApiError(error));
        }
      } finally {
        setQrLoading(false);
        qrRequestRef.current = null;
      }
    };
    void createQrSale();
  }, [step, saleId, items, total]);

  const handleCashConfirm = async () => {
    if (!isCashValid) {
      return;
    }
    setIsSubmitting(true);
    setCashError(null);
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
      handleClose();
    } catch (error) {
      setCashError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartQr = () => {
    setStep('QR_WAIT');
    setSaleId(null);
    setQrStatus('PENDING');
    setQrMessage(null);
    setQrError(null);
  };

  const handleRetryQr = () => {
    clearQrTimers();
    abortQrRequest();
    setSaleId(null);
    setQrStatus('PENDING');
    setQrMessage(null);
    setQrError(null);
    setStep('QR_WAIT');
  };

  const handleCancelQr = async () => {
    abortQrRequest();
    clearQrTimers();
    if (saleId) {
      await cancelQrSale(saleId);
    }
    setSaleId(null);
    setQrStatus(null);
    setQrMessage(null);
    setQrError(null);
    setStep('SELECT_METHOD');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={handleClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Checkout</h2>
          <button type="button" className="icon-button" onClick={handleClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {step === 'SELECT_METHOD' && (
            <div className="checkout-step">
              <p className="checkout-total">Total: <strong>{formatCurrency(total)}</strong></p>
              <div className="checkout-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setStep('CASH')}
                  disabled={items.length === 0}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleStartQr}
                  disabled={items.length === 0}
                >
                  QR
                </button>
              </div>
            </div>
          )}
          {step === 'CASH' && (
            <div className="checkout-step">
              <p className="checkout-total">Total: <strong>{formatCurrency(total)}</strong></p>
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
                  <p className="error-text">Falta: {formatCurrency(roundToCurrency(total - receivedAmount))}</p>
                ) : (
                  <p>Vuelto: {formatCurrency(changeAmount)}</p>
                )}
              </div>
              {cashError && <p className="error-text">{cashError}</p>}
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
          {step === 'QR_WAIT' && (
            <div className="checkout-step">
              <p className="checkout-total">Total: <strong>{formatCurrency(total)}</strong></p>
              <div className="qr-wait">
                <div className="spinner" aria-hidden="true" />
                <p>Esperando pago…</p>
                <p className="qr-timer">{formatTime(timeLeft)}</p>
                {qrLoading && <p>Preparando QR...</p>}
                {qrMessage && <p className="error-text">{qrMessage}</p>}
                {qrError && <p className="error-text">{qrError}</p>}
              </div>
              <div className="checkout-actions">
                {qrMessage || qrError ? (
                  <>
                    <button type="button" className="ghost-button" onClick={handleCancelQr}>
                      Volver
                    </button>
                    <button type="button" className="primary-button" onClick={handleRetryQr}>
                      Reintentar
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost-button" onClick={handleCancelQr}>
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

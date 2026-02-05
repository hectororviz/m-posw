import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { apiClient, getUploadsBaseUrl, normalizeApiError } from '../api/client';
import type { PaymentMethod, Sale, SaleStatus } from '../api/types';
import { useSettings } from '../api/queries';
import { useCart } from '../context/CartContext';
import { useToast } from './ToastProvider';
import { maybePrintTicket } from '../utils/ticketPrinting';

type CheckoutStep = 'SELECT_METHOD' | 'CASH' | 'QR_WAIT' | 'QR_RESULT';
type QrResultType = 'SUCCESS' | 'ERROR';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const roundToCurrency = (value: number) => Math.round(value * 100) / 100;

const sanitizeCurrencyInput = (value: string) => {
  const normalized = value.replace(/[^\d.,]/g, '');
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const separatorIndex = Math.max(lastDot, lastComma);
  let integerPart = normalized;
  let decimalPart = '';
  if (separatorIndex >= 0) {
    integerPart = normalized.slice(0, separatorIndex);
    decimalPart = normalized.slice(separatorIndex + 1);
  }
  integerPart = integerPart.replace(/[^\d]/g, '');
  decimalPart = decimalPart.replace(/[^\d]/g, '').slice(0, 2);
  if (!integerPart && !decimalPart) {
    return '';
  }
  if (separatorIndex >= 0) {
    return `${integerPart || '0'}.${decimalPart}`;
  }
  return integerPart;
};

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
  const { data: settings } = useSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('SELECT_METHOD');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<SaleStatus | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [qrResult, setQrResult] = useState<QrResultType | null>(null);
  const [qrResultMessage, setQrResultMessage] = useState<string | null>(null);
  const [okAnimationData, setOkAnimationData] = useState<Record<string, unknown> | null>(null);
  const [errorAnimationData, setErrorAnimationData] = useState<Record<string, unknown> | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);
  const qrRequestRef = useRef<AbortController | null>(null);
  const qrPollRef = useRef<number | null>(null);
  const qrTimerRef = useRef<number | null>(null);
  const pollingInFlight = useRef(false);
  const itemsSnapshotRef = useRef(items);

  const total = useMemo(
    () => roundToCurrency(items.reduce((acc, item) => acc + item.product.price * item.quantity, 0)),
    [items],
  );

  useEffect(() => {
    itemsSnapshotRef.current = items;
  }, [items]);

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
    setQrResult(null);
    setQrResultMessage(null);
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
    if (qrResult) {
      return;
    }
    abortQrRequest();
    clearQrTimers();
    if (saleId && step === 'QR_WAIT' && qrStatus === 'PENDING') {
      void cancelQrSale(saleId);
    }
    onClose();
  }, [qrResult, saleId, step, qrStatus, onClose]);

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

  const resolveAnimationUrl = useCallback((path?: string | null) => {
    if (!path) {
      return undefined;
    }
    if (path.startsWith('http')) {
      return path;
    }
    const base = getUploadsBaseUrl();
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }, []);

  useEffect(() => {
    const url = resolveAnimationUrl(settings?.okAnimationUrl);
    if (!url) {
      setOkAnimationData(null);
      return;
    }
    const controller = new AbortController();
    const loadAnimation = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('No se pudo cargar la animación OK');
        }
        const data = (await response.json()) as Record<string, unknown>;
        setOkAnimationData(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setOkAnimationData(null);
        }
      }
    };
    void loadAnimation();
    return () => controller.abort();
  }, [resolveAnimationUrl, settings?.okAnimationUrl]);

  useEffect(() => {
    const url = resolveAnimationUrl(settings?.errorAnimationUrl);
    if (!url) {
      setErrorAnimationData(null);
      return;
    }
    const controller = new AbortController();
    const loadAnimation = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('No se pudo cargar la animación Error');
        }
        const data = (await response.json()) as Record<string, unknown>;
        setErrorAnimationData(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorAnimationData(null);
        }
      }
    };
    void loadAnimation();
    return () => controller.abort();
  }, [resolveAnimationUrl, settings?.errorAnimationUrl]);

  const handleCashInputChange = (value: string) => {
    setCashReceived(sanitizeCurrencyInput(value));
  };

  const appendCashDigit = (digit: string) => {
    setCashReceived((prev) => {
      const [, decimalPart = ''] = prev.split('.');
      if (prev.includes('.') && decimalPart.length >= 2) {
        return prev;
      }
      if (!prev && digit === '0') {
        return '0';
      }
      return `${prev}${digit}`;
    });
  };

  const appendCashDecimal = () => {
    setCashReceived((prev) => {
      if (prev.includes('.')) {
        return prev;
      }
      return prev ? `${prev}.` : '0.';
    });
  };

  const handleCashBackspace = () => {
    setCashReceived((prev) => prev.slice(0, -1));
  };

  const handleCashClear = () => {
    setCashReceived('');
  };

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
          await maybePrintTicket({
            settings,
            saleId,
            dateTimeISO: new Date().toISOString(),
            total,
            items: itemsSnapshotRef.current.map((item) => ({
              qty: item.quantity,
              name: item.product.name,
            })),
            onPopupBlocked: () =>
              pushToast('No se pudo abrir la ventana de impresión. Revisá el bloqueador de popups.', 'error'),
            onAlreadyPrinted: () => pushToast('El ticket ya fue impreso.', 'error'),
            onError: (message) => pushToast(message, 'error'),
          });
          clear();
          setQrResult('SUCCESS');
          setQrResultMessage('Pago confirmado.');
          setStep('QR_RESULT');
        } else if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') {
          clearQrTimers();
          const message =
            status === 'REJECTED'
              ? 'Pago rechazado.'
              : status === 'EXPIRED'
                ? 'El pago expiró.'
                : 'Pago cancelado.';
          setQrMessage(message);
          setQrResult('ERROR');
          setQrResultMessage(message);
          setStep('QR_RESULT');
        }
      } catch (error) {
        clearQrTimers();
        const message = normalizeApiError(error);
        setQrError(message);
        setQrResult('ERROR');
        setQrResultMessage(message);
        setStep('QR_RESULT');
      } finally {
        pollingInFlight.current = false;
      }
    }, 2000);
  }, [step, saleId, timeLeft, total, settings, clear, handleClose, pushToast]);

  useEffect(() => {
    if (step !== 'QR_WAIT' || !saleId) {
      return;
    }
    if (timeLeft === 0 && qrStatus !== 'APPROVED') {
      clearQrTimers();
      const message = 'Tiempo agotado.';
      setQrMessage(message);
      setQrResult('ERROR');
      setQrResultMessage(message);
      setStep('QR_RESULT');
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
      const response = await apiClient.post<Sale>('/sales/cash', {
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        total,
        paymentMethod: 'CASH' as PaymentMethod,
        cashReceived: receivedAmount,
        changeAmount,
      });
      const sale = response.data;
      await maybePrintTicket({
        settings,
        saleId: sale.id,
        dateTimeISO: sale.paidAt ?? sale.createdAt,
        total: sale.total,
        items: sale.items.map((item) => ({ qty: item.quantity, name: item.product.name })),
        onPopupBlocked: () =>
          pushToast('No se pudo abrir la ventana de impresión. Revisá el bloqueador de popups.', 'error'),
        onError: (message) => pushToast(message, 'error'),
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
    setQrResult(null);
    setQrResultMessage(null);
  };

  const handleRetryQr = () => {
    clearQrTimers();
    abortQrRequest();
    setSaleId(null);
    setQrStatus('PENDING');
    setQrMessage(null);
    setQrError(null);
    setQrResult(null);
    setQrResultMessage(null);
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
    setQrResult(null);
    setQrResultMessage(null);
    setStep('SELECT_METHOD');
  };

  const handleResultOk = async () => {
    abortQrRequest();
    clearQrTimers();
    if (qrResult === 'ERROR' && saleId && qrStatus === 'PENDING') {
      await cancelQrSale(saleId);
    }
    resetState();
    onClose();
    navigate('/');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={qrResult ? undefined : handleClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Checkout</h2>
          <button
            type="button"
            className="icon-button"
            onClick={handleClose}
            aria-label="Cerrar"
            disabled={Boolean(qrResult)}
          >
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
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={formatCurrency(receivedAmount)}
                  onChange={(event) => handleCashInputChange(event.target.value)}
                />
              </label>
              <div className="pin-keypad cash-keypad" aria-label="Teclado numérico">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className="pin-key"
                    onClick={() => appendCashDigit(digit)}
                  >
                    {digit}
                  </button>
                ))}
                <button type="button" className="pin-key" onClick={appendCashDecimal}>
                  ,
                </button>
                <button type="button" className="pin-key" onClick={() => appendCashDigit('0')}>
                  0
                </button>
                <button type="button" className="pin-key pin-key--secondary" onClick={handleCashBackspace}>
                  Borrar
                </button>
                <button type="button" className="pin-key pin-key--secondary pin-key--wide" onClick={handleCashClear}>
                  Limpiar
                </button>
              </div>
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
          {step === 'QR_RESULT' && (
            <div className="checkout-step qr-result">
              <div className="qr-result-animation">
                {qrResult === 'SUCCESS' ? (
                  okAnimationData ? (
                    <Lottie animationData={okAnimationData} autoplay loop={false} />
                  ) : (
                    <p>Animación OK no configurada.</p>
                  )
                ) : errorAnimationData ? (
                  <Lottie animationData={errorAnimationData} autoplay loop={false} />
                ) : (
                  <p>Animación Error no configurada.</p>
                )}
              </div>
              {qrResultMessage && <p className="qr-result-message">{qrResultMessage}</p>}
              <div className="qr-result-actions">
                <button type="button" className="primary-button" onClick={handleResultOk}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

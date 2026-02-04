import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';
import type { PaymentStatus } from '../api/types';
import { useSettings } from '../api/queries';
import { AppLayout } from '../components/AppLayout';
import { useToast } from '../components/ToastProvider';
import { useCart } from '../context/CartContext';
import { maybePrintTicket } from '../utils/ticketPrinting';

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

type PaymentStatusResponse = {
  saleId: string;
  status: PaymentStatus;
  mpStatus?: string | null;
  mpStatusDetail?: string | null;
  paymentId?: string;
  merchantOrderId?: string;
  updatedAt?: string;
};

const waitingStatuses = new Set<PaymentStatus>([
  'PENDING',
  'IN_PROCESS',
  'WAITING_PAYMENT',
  'NONE',
]);

const getStatusMessage = (status: PaymentStatus) => {
  switch (status) {
    case 'APPROVED':
      return 'Pago aprobado.';
    case 'REJECTED':
      return 'Pago rechazado.';
    case 'CANCELLED':
      return 'Pago cancelado.';
    case 'EXPIRED':
      return 'Pago vencido.';
    case 'PENDING':
    case 'IN_PROCESS':
    case 'WAITING_PAYMENT':
    case 'NONE':
    default:
      return 'Esperando pago…';
  }
};

export const CheckoutQrPage: React.FC = () => {
  const { saleId } = useParams();
  const navigate = useNavigate();
  const { clear, items } = useCart();
  const { pushToast } = useToast();
  const { data: settings } = useSettings();
  const defaultTimeout = 120;
  const configuredTimeout = Number(import.meta.env.VITE_QR_PAYMENT_TIMEOUT ?? defaultTimeout);
  const paymentTimeoutSeconds =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : defaultTimeout;
  const [status, setStatus] = useState<PaymentStatus>('PENDING');
  const [mpStatusDetail, setMpStatusDetail] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(paymentTimeoutSeconds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const itemsSnapshotRef = useRef(items);

  const isWaiting = waitingStatuses.has(status);

  const statusMessage = useMemo(() => {
    return getStatusMessage(status);
  }, [status]);

  const total = useMemo(
    () => roundToCurrency(items.reduce((acc, item) => acc + item.product.price * item.quantity, 0)),
    [items],
  );

  useEffect(() => {
    itemsSnapshotRef.current = items;
  }, [items]);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleTerminalStatus = useCallback(
    async (nextStatus: PaymentStatus, detail?: string | null) => {
      if (!saleId || hasCompletedRef.current) {
        return;
      }
      if (nextStatus === 'APPROVED') {
        if (isFinalizing) {
          return;
        }
        setIsFinalizing(true);
        try {
          await apiClient.post(`/sales/${saleId}/complete`);
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
          hasCompletedRef.current = true;
          clear();
          pushToast('Venta finalizada', 'success');
          navigate('/');
        } catch (error) {
          setErrorMessage(normalizeApiError(error));
        } finally {
          setIsFinalizing(false);
        }
        return;
      }
      if (nextStatus === 'REJECTED' || nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED') {
        const message = detail || getStatusMessage(nextStatus);
        setErrorMessage(message);
        pushToast(message, 'error');
      }
    },
    [saleId, isFinalizing, settings, total, clear, pushToast, navigate],
  );

  const handleStatusUpdate = useCallback(
    (payload: PaymentStatusResponse) => {
      console.info('payment-status response', payload);
      setStatus(payload.status);
      setMpStatusDetail(payload.mpStatusDetail ?? null);
      setErrorMessage(null);
      if (!waitingStatuses.has(payload.status)) {
        stopPolling();
        void handleTerminalStatus(payload.status, payload.mpStatusDetail ?? null);
      }
    },
    [handleTerminalStatus],
  );

  useEffect(() => {
    if (!saleId) {
      return;
    }
    let isActive = true;
    const poll = async () => {
      if (!isActive || hasCompletedRef.current) {
        return;
      }
      try {
        const response = await apiClient.get<PaymentStatusResponse>(
          `/sales/${saleId}/payment-status`,
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
            },
          },
        );
        handleStatusUpdate(response.data);
      } catch (error) {
        console.warn('payment-status error', error);
        setErrorMessage('No se pudo verificar el pago. Reintentando...');
      }
    };
    void poll();
    pollingRef.current = window.setInterval(poll, 2000);
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [saleId, handleStatusUpdate]);

  useEffect(() => {
    if (!saleId || hasCompletedRef.current) {
      return;
    }
    setTimeLeft(paymentTimeoutSeconds);
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [saleId, paymentTimeoutSeconds]);

  useEffect(() => {
    if (timeLeft !== 0 || !isWaiting) {
      return;
    }
    stopPolling();
    const message = 'Tiempo agotado.';
    setErrorMessage(message);
    pushToast(message, 'error');
    navigate('/checkout/payment');
  }, [timeLeft, isWaiting, navigate, pushToast]);

  if (!saleId) {
    return (
      <AppLayout title="Pago QR">
        <p>No se encontró la venta.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Pago QR">
      <div className="checkout-step">
        <p className="checkout-total">
          Total: <strong>{formatCurrency(total)}</strong>
        </p>
        <div className="qr-wait">
          {isWaiting && <div className="spinner" aria-hidden="true" />}
          <p>{statusMessage}</p>
          <p className="qr-status">Estado: {status}</p>
          <p className="qr-timer">{formatTime(timeLeft)}</p>
          {!isWaiting && <p className="error-text">{statusMessage}</p>}
          {mpStatusDetail && <p className="error-text">{mpStatusDetail}</p>}
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </div>
        <div className="checkout-actions">
          <button type="button" className="ghost-button" onClick={() => navigate('/checkout/payment')}>
            Volver
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

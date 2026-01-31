import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { apiClient, getWsBaseUrl, normalizeApiError } from '../api/client';
import type { PaymentStatus } from '../api/types';
import { AppLayout } from '../components/AppLayout';
import { useToast } from '../components/ToastProvider';
import { useCart } from '../context/CartContext';

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
  paymentStatus: PaymentStatus;
  mpStatus?: string | null;
  mpStatusDetail?: string | null;
};

export const CheckoutQrPage: React.FC = () => {
  const { saleId } = useParams();
  const navigate = useNavigate();
  const { clear, items } = useCart();
  const { pushToast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>('PENDING');
  const [mpStatusDetail, setMpStatusDetail] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasCompletedRef = useRef(false);

  const total = useMemo(
    () => roundToCurrency(items.reduce((acc, item) => acc + item.product.price * item.quantity, 0)),
    [items],
  );

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearTimeout(pollingRef.current);
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
      if (nextStatus === 'REJECTED' || nextStatus === 'EXPIRED') {
        const message =
          nextStatus === 'REJECTED'
            ? detail || 'Pago rechazado.'
            : detail || 'El pago expiró.';
        setErrorMessage(message);
        pushToast(message, 'error');
        navigate('/checkout/payment');
      }
    },
    [saleId, isFinalizing, clear, pushToast, navigate],
  );

  const handleStatusUpdate = useCallback(
    (payload: PaymentStatusResponse) => {
      setStatus(payload.paymentStatus);
      setMpStatusDetail(payload.mpStatusDetail ?? null);
      if (payload.paymentStatus !== 'PENDING') {
        stopPolling();
        void handleTerminalStatus(payload.paymentStatus, payload.mpStatusDetail ?? null);
      }
    },
    [handleTerminalStatus],
  );

  useEffect(() => {
    if (!saleId) {
      return;
    }
    const socket = io(getWsBaseUrl(), {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('authToken') ?? undefined },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('sale.join', { saleId });
    });

    socket.on('sale.payment_status_changed', (payload: PaymentStatusResponse & { saleId?: string }) => {
      if (payload.saleId && payload.saleId !== saleId) {
        return;
      }
      handleStatusUpdate(payload);
    });

    socket.on('connect_error', (err) => {
      setErrorMessage(err.message);
    });

    return () => {
      socket.off('sale.payment_status_changed');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [saleId, handleStatusUpdate]);

  useEffect(() => {
    if (!saleId) {
      return;
    }
    let isActive = true;
    const startTime = Date.now();
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
        setErrorMessage(normalizeApiError(error));
      } finally {
        if (!isActive || hasCompletedRef.current) {
          return;
        }
        const elapsed = Date.now() - startTime;
        const interval = elapsed < 30_000 ? 2000 : 5000;
        pollingRef.current = window.setTimeout(poll, interval);
      }
    };
    void poll();
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [saleId, handleStatusUpdate]);

  useEffect(() => {
    if (!saleId || hasCompletedRef.current) {
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [saleId]);

  useEffect(() => {
    if (timeLeft !== 0 || status !== 'PENDING') {
      return;
    }
    stopPolling();
  }, [timeLeft, status]);

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
          <div className="spinner" aria-hidden="true" />
          <p>Esperando pago…</p>
          <p className="qr-timer">{formatTime(timeLeft)}</p>
          {status !== 'PENDING' && (
            <p className="error-text">
              {status === 'APPROVED'
                ? 'Pago aprobado.'
                : status === 'REJECTED'
                  ? 'Pago rechazado.'
                  : 'Pago expirado.'}
            </p>
          )}
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

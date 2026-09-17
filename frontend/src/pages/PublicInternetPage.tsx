import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import './PublicInternet.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

interface PublicStatus {
  available: boolean;
  reason: 'AVAILABLE' | 'INTERNET_DISABLED' | 'MP_NOT_LINKED' | 'NO_PLANS';
  storeName: string;
  clubName: string;
  logoUrl: string | null;
}

interface PublicPlan {
  id: string;
  name: string;
  duration: number;
  price: number;
  downloadBandwidth: string;
  uploadBandwidth: string;
}

interface PublicOrder {
  orderId: string;
  status: string;
  paymentStatus: string;
  planName: string;
  price: number;
  duration: number | null;
  pin: string | null;
  wifi: { ssid: string | null; portalUrl: string | null; helpText: string | null };
}

const REASON_TEXT: Record<PublicStatus['reason'], string> = {
  AVAILABLE: '',
  INTERNET_DISABLED: 'La venta de internet no está habilitada en este momento.',
  MP_NOT_LINKED: 'El pago online no está disponible en este momento. Probá más tarde.',
  NO_PLANS: 'No hay planes disponibles en este momento. Probá más tarde.',
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds >= 86400 && seconds % 86400 === 0) {
    const d = seconds / 86400;
    return d === 1 ? '1 día' : `${d} días`;
  }
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600;
    return h === 1 ? '1 hora' : `${h} horas`;
  }
  const m = Math.round(seconds / 60);
  return m === 1 ? '1 minuto' : `${m} minutos`;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.message === 'string') message = data.message;
    } catch {
      // usar mensaje por defecto
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const PublicInternetPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const mpStatus = searchParams.get('status') ?? searchParams.get('collection_status');

  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await apiGet<PublicStatus>('/internet/public/status');
        if (!active) return;
        setStatus(s);
        if (s.available && !orderId) {
          try {
            const p = await apiGet<PublicPlan[]>('/internet/public/plans');
            if (active) setPlans(p);
          } catch (err) {
            if (active) setPlansError(err instanceof Error ? err.message : 'No se pudieron cargar los planes');
          }
        }
      } catch (err) {
        if (active) setStatusError(err instanceof Error ? err.message : 'No se pudo cargar el servicio');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchOrder = useCallback(async (id: string) => {
    try {
      const o = await apiGet<PublicOrder>(`/internet/public/orders/${id}`);
      setOrder(o);
      setOrderError(null);
      if (o.paymentStatus === 'APPROVED' || o.paymentStatus === 'REJECTED' || o.paymentStatus === 'EXPIRED') {
        stopPolling();
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'No se pudo consultar la orden');
      stopPolling();
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    void fetchOrder(orderId);
    stopPolling();
    pollRef.current = window.setInterval(() => void fetchOrder(orderId), 2500);
    const timeout = window.setTimeout(stopPolling, 10 * 60 * 1000);
    return () => {
      stopPolling();
      window.clearTimeout(timeout);
    };
  }, [orderId, fetchOrder]);

  const handleBuy = async (plan: PublicPlan) => {
    setBuyingId(plan.id);
    setBuyError(null);
    try {
      const res = await fetch(`${API_BASE}/internet/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ planId: plan.id, returnBaseUrl: window.location.origin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'No se pudo iniciar el pago');
      }
      if (!data?.initPoint) throw new Error('Mercado Pago no devolvió link de pago');
      window.location.href = data.initPoint as string;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'No se pudo iniciar el pago');
      setBuyingId(null);
    }
  };

  const handleCopyPin = async () => {
    if (!order?.pin) return;
    try {
      await navigator.clipboard.writeText(order.pin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const brand = useMemo(() => {
    const name = status?.storeName || 'Internet WiFi';
    const logo = status?.logoUrl ? buildImageUrl(status.logoUrl) : undefined;
    return { name, club: status?.clubName || '', logo };
  }, [status]);

  const backToPlans = () => {
    window.location.href = '/internet';
  };

  return (
    <div className="pub-internet-page">
      <div className="pub-internet-card">
        <div className="pub-internet-brand">
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name} className="pub-internet-logo" />
          ) : (
            <div className="pub-internet-logo-placeholder">WiFi</div>
          )}
          <div>
            <h1 className="pub-internet-title">{brand.name}</h1>
            {brand.club && <p className="pub-internet-subtitle">{brand.club}</p>}
            <p className="pub-internet-tag">Venta de acceso a internet</p>
          </div>
        </div>

        {loading && (
          <div className="pub-internet-state">
            <div className="spinner" aria-hidden="true" />
            <p>Cargando planes...</p>
          </div>
        )}

        {!loading && statusError && <p className="error-text">{statusError}</p>}

        {!loading && !statusError && status && !status.available && (
          <div className="pub-internet-state">
            <p className="pub-internet-unavailable-title">Servicio no disponible</p>
            <p>{REASON_TEXT[status.reason]}</p>
          </div>
        )}

        {!loading && !statusError && status?.available && orderId && (
          <OrderResult
            order={order}
            orderError={orderError}
            mpStatus={mpStatus}
            copied={copied}
            onCopy={handleCopyPin}
            onBack={backToPlans}
          />
        )}

        {!loading && !statusError && status?.available && !orderId && (
          <>
            {plansError && <p className="error-text">{plansError}</p>}
            {!plansError && plans.length === 0 && <p>No hay planes disponibles en este momento.</p>}
            <div className="pub-internet-grid">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="pub-internet-plan"
                  disabled={buyingId !== null}
                  onClick={() => void handleBuy(plan)}
                >
                  <span className="pub-internet-plan-name">{plan.name}</span>
                  <span className="pub-internet-plan-duration">{formatDuration(plan.duration)}</span>
                  <span className="pub-internet-plan-speed">
                    {plan.downloadBandwidth} / {plan.uploadBandwidth}
                  </span>
                  <span className="pub-internet-plan-price">{formatPrice(plan.price)}</span>
                  <span className="pub-internet-plan-cta">
                    {buyingId === plan.id ? 'Redirigiendo a Mercado Pago...' : 'Comprar'}
                  </span>
                </button>
              ))}
            </div>
            {buyError && <p className="error-text">{buyError}</p>}
            <p className="pub-internet-hint">Al presionar un plan serás redirigido a Mercado Pago para pagar. Al finalizar volvés acá y ves tu PIN.</p>
          </>
        )}
      </div>
    </div>
  );
};

const OrderResult: React.FC<{
  order: PublicOrder | null;
  orderError: string | null;
  mpStatus: string | null;
  copied: boolean;
  onCopy: () => void;
  onBack: () => void;
}> = ({ order, orderError, mpStatus, copied, onCopy, onBack }) => {
  if (orderError) {
    return (
      <div className="pub-internet-state">
        <p className="pub-internet-unavailable-title">No pudimos encontrar tu compra</p>
        <p>{orderError}</p>
        <button type="button" className="pub-internet-back" onClick={onBack}>Ver planes</button>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="pub-internet-state">
        <div className="spinner" aria-hidden="true" />
        <p>Consultando tu pago...</p>
      </div>
    );
  }
  if (order.paymentStatus === 'APPROVED' && order.pin) {
    return (
      <div className="pub-internet-success">
        <p className="pub-internet-success-title">¡Pago acreditado!</p>
        <p className="pub-internet-plan-line">{order.planName} · {formatPrice(order.price)}</p>
        <div className="pub-internet-pin-box">
          <span className="pub-internet-pin-label">Tu PIN de acceso</span>
          <span className="pub-internet-pin">{order.pin}</span>
          <button type="button" className="pub-internet-copy" onClick={onCopy}>
            {copied ? '¡Copiado!' : 'Copiar PIN'}
          </button>
        </div>
        <div className="pub-internet-instructions">
          <h2>Cómo conectarte</h2>
          <ol>
            {order.wifi.ssid && (
              <li>Conectate a la red WiFi <strong>{order.wifi.ssid}</strong>.</li>
            )}
            {!order.wifi.ssid && <li>Conectate a la red WiFi del lugar.</li>}
            {order.wifi.portalUrl ? (
              <li>Si no se abre solo, entrá a <strong>{order.wifi.portalUrl}</strong> e ingresá tu PIN.</li>
            ) : (
              <li>Cuando te lo pida, ingresá tu PIN.</li>
            )}
            {order.duration ? (
              <li>Tu acceso dura <strong>{formatDuration(order.duration)}</strong> desde el primer uso.</li>
            ) : null}
          </ol>
          {order.wifi.helpText && <p className="pub-internet-help">{order.wifi.helpText}</p>}
          {mpStatus && mpStatus.toLowerCase() !== 'approved' && (
            <p className="pub-internet-hint">Estado informado por Mercado Pago: {mpStatus}.</p>
          )}
        </div>
        <button type="button" className="pub-internet-back" onClick={onBack}>Comprar otro acceso</button>
      </div>
    );
  }
  if (order.paymentStatus === 'REJECTED' || order.paymentStatus === 'EXPIRED' || order.status === 'REJECTED' || order.status === 'EXPIRED' || order.status === 'CANCELLED') {
    return (
      <div className="pub-internet-state">
        <p className="pub-internet-unavailable-title">El pago no se completó</p>
        <p>Estado: {order.paymentStatus}. Probá de nuevo con otro medio de pago.</p>
        <button type="button" className="pub-internet-back" onClick={onBack}>Volver a los planes</button>
      </div>
    );
  }
  return (
    <div className="pub-internet-state">
      <div className="spinner" aria-hidden="true" />
      <p>Esperando la confirmación de Mercado Pago...</p>
      <p className="pub-internet-hint">No cierres esta página. Tu PIN aparece acá automáticamente al acreditarse el pago.</p>
      <button type="button" className="pub-internet-back" onClick={onBack}>Volver a los planes</button>
    </div>
  );
};

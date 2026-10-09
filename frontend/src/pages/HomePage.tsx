import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, CalendarX, Clock, FolderOpen, Package, ShoppingCart, Ticket, UserMinus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAdminSales, useSettings } from '../api/queries';
import { useHomeMetrics } from '../hooks/useHomeMetrics';
import { useAuth } from '../context/AuthContext';
import { Delta, ListError } from '../components/ui/Card';
import { formatDate, formatDateLong, formatDateTime, formatMoney } from '../utils/format';

// Base mínima (en $) para mostrar una variación porcentual con contexto.
const UMBRAL_BASE_VARIACION = 1000;

const formatTodayLong = () => formatDateLong(new Date());

function comparable(variacion: number | null, base: number): number | null {
  if (variacion === null) return null;
  if (!Number.isFinite(variacion)) return null;
  if (Math.abs(base) < UMBRAL_BASE_VARIACION) return null;
  return variacion;
}

interface ActionData {
  icon: ReactNode;
  label: string;
  value: string;
  to: string;
  alert: 'danger' | 'warning';
}

interface ActivityData {
  icon: ReactNode;
  label: string;
  value: string;
  delta: number | null;
}

interface SummaryData {
  icon: ReactNode;
  label: string;
  value: string;
}

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Efectivo', MP_QR: 'QR', TRANSFER: 'Transf.', FIADO: 'Fiado' };

export const HomePage: React.FC = () => {
  const { data: settings } = useSettings();
  const { data: metrics, isLoading, isError, refetch } = useHomeMetrics();
  const { data: sales } = useAdminSales();
  const { user } = useAuth();

  const clubName = settings?.clubName || settings?.storeName || 'm-POSw';
  const username = user?.username || 'Usuario';
  const today = formatTodayLong();
  const cardIconSize = 24;

  const actions: ActionData[] = [];
  if (metrics?.socios && metrics.socios.cuotasVencidas > 0) {
    actions.push({
      icon: <CalendarX size={cardIconSize} />, label: 'Cuotas vencidas',
      value: String(metrics.socios.cuotasVencidas), to: '/admin/socios', alert: 'danger',
    });
  }
  if (metrics?.internet && metrics.internet.vouchersVencenHoy > 0) {
    actions.push({
      icon: <AlertCircle size={cardIconSize} />, label: 'Vencen hoy',
      value: String(metrics.internet.vouchersVencenHoy), to: '/admin/internet', alert: 'warning',
    });
  }
  if (metrics?.acreedores && metrics.acreedores.activos > 0) {
    actions.push({
      icon: <UserMinus size={cardIconSize} />, label: 'Acreedores con deuda',
      value: String(metrics.acreedores.activos), to: '/admin/acreedores', alert: 'warning',
    });
  }
  if (metrics?.acreedores && metrics.acreedores.deudaTotal > 0) {
    actions.push({
      icon: <Clock size={cardIconSize} />, label: 'Deuda total',
      value: formatMoney(metrics.acreedores.deudaTotal), to: '/admin/acreedores', alert: 'danger',
    });
  }

  const activity: ActivityData[] = [];
  if (metrics?.pos) {
    const variacionHoy = metrics.pos.ventasAyer === 0
      ? null
      : ((metrics.pos.ventasHoy - metrics.pos.ventasAyer) / metrics.pos.ventasAyer) * 100;
    const variacionSemana = metrics.pos.ventasSemanaPasada === 0
      ? null
      : ((metrics.pos.ventasSemana - metrics.pos.ventasSemanaPasada) / metrics.pos.ventasSemanaPasada) * 100;
    activity.push(
      {
        icon: <ShoppingCart size={28} />, label: 'Ventas hoy',
        value: formatMoney(metrics.pos.ventasHoy),
        delta: comparable(variacionHoy, metrics.pos.ventasAyer),
      },
      {
        icon: <CalendarDays size={28} />, label: 'Ventas 7 días',
        value: formatMoney(metrics.pos.ventasSemana),
        delta: comparable(variacionSemana, metrics.pos.ventasSemanaPasada),
      },
    );
  }

  const summary: SummaryData[] = [];
  if (metrics?.socios) {
    summary.push({ icon: <Users size={cardIconSize} />, label: 'Socios activos', value: String(metrics.socios.activos) });
  }
  if (metrics?.stock) {
    summary.push(
      { icon: <Package size={cardIconSize} />, label: 'Productos', value: String(metrics.stock.productos) },
      { icon: <FolderOpen size={cardIconSize} />, label: 'Categorías', value: String(metrics.stock.categorias) },
    );
  }
  if (metrics?.internet) {
    summary.push({ icon: <Ticket size={cardIconSize} />, label: 'Vouchers activos', value: String(metrics.internet.vouchersActivos) });
  }

  // TODO: reemplazar por un endpoint de últimos movimientos cuando exista (hoy se deriva de GET /sales).
  const ultimos = (sales ?? []).slice(0, 5);

  return (
    <div className="home-page">
      <div className="home-welcome">
        <h1 className="home-welcome-title">
          Bienvenido a {clubName}, {username}
        </h1>
        <p className="home-welcome-date">{today}</p>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
          Cargando métricas...
        </p>
      )}

      {!isLoading && isError && <ListError onRetry={() => refetch()} />}

      {!isLoading && actions.length > 0 && (
        <section aria-label="Atención">
          <h2 className="home-section-title">Atención</h2>
          <div className="home-grid home-grid--attention">
            {actions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className={`home-card home-card--action home-card--alert-${a.alert}`}
              >
                <span className={`home-card-icon home-card-icon--alert-${a.alert}`}>
                  {a.icon}
                </span>
                <span className={`home-card-value home-card-value--alert-${a.alert}`}>
                  {a.value}
                </span>
                <span className="home-card-label">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!isLoading && activity.length > 0 && (
        <section aria-label="Actividad">
          <h2 className="home-section-title">Actividad</h2>
          <div className="home-grid home-grid--primary">
            {activity.map((c) => (
              <div key={c.label} className="home-card home-card--primary">
                <span className="home-card-icon">{c.icon}</span>
                <span className="home-card-value">{c.value}</span>
                {c.delta !== null && <Delta value={c.delta} />}
                <span className="home-card-label">{c.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && summary.length > 0 && (
        <section aria-label="Resumen">
          <h2 className="home-section-title">Resumen</h2>
          <div className="home-grid home-grid--secondary">
            {summary.map((c) => (
              <div key={c.label} className="home-card home-card--secondary">
                <span className="home-card-icon">{c.icon}</span>
                <span className="home-card-value">{c.value}</span>
                <span className="home-card-label">{c.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && ultimos.length > 0 && (
        <section aria-label="Últimos movimientos">
          <div className="home-section-head">
            <h2 className="home-section-title">Últimos movimientos</h2>
            <Link to="/admin/sales" className="home-section-link">Ver ventas</Link>
          </div>
          <div className="home-movements">
            {ultimos.map((s) => (
              <Link key={s.id} to="/admin/sales" className="home-movement-row">
                <span className="home-movement-main">
                  <strong>#{s.orderNumber}</strong>
                  <span className="home-movement-meta">
                    {formatDate(s.createdAt)} {formatDateTime(s.createdAt).slice(11)} · {PAYMENT_LABELS[s.paymentMethod ?? ''] ?? s.paymentMethod ?? '—'}
                  </span>
                </span>
                <span className="home-movement-amount">{formatMoney(s.total)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!isLoading && actions.length === 0 && activity.length === 0 && summary.length === 0 && (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
          No hay información disponible
        </p>
      )}
    </div>
  );
};

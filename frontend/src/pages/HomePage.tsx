import { AlertCircle, CalendarDays, CalendarX, Clock, FolderOpen, Package, ShoppingCart, Ticket, TrendingDown, TrendingUp, UserMinus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSettings } from '../api/queries';
import { useHomeMetrics } from '../hooks/useHomeMetrics';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = () => {
  const now = new Date();
  return now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

interface CardData {
  icon: ReactNode;
  label: string;
  value: string;
  key: string;
  level: 'primary' | 'standard' | 'secondary';
  alert?: 'danger' | 'warning';
  trend?: { direction: 'up' | 'down' | 'flat'; pct: string } | null;
}

export const HomePage: React.FC = () => {
  const { data: settings } = useSettings();
  const { data: metrics, isLoading } = useHomeMetrics();
  const { user } = useAuth();

  const clubName = settings?.clubName || settings?.storeName || 'm-POSw';
  const username = user?.username || 'Usuario';
  const today = formatDate();
  const cardIconSize = 24;

  const primaryCards: CardData[] = [];
  const standardCards: CardData[] = [];
  const secondaryCards: CardData[] = [];

  if (metrics?.pos) {
    const variacionHoy = metrics.pos.ventasAyer === 0
      ? null
      : ((metrics.pos.ventasHoy - metrics.pos.ventasAyer) / metrics.pos.ventasAyer) * 100;

    const variacionSemana = metrics.pos.ventasSemanaPasada === 0
      ? null
      : ((metrics.pos.ventasSemana - metrics.pos.ventasSemanaPasada) / metrics.pos.ventasSemanaPasada) * 100;

    const trendHoy = variacionHoy === null ? null
      : variacionHoy > 0 ? { direction: 'up' as const, pct: variacionHoy.toFixed(1) }
      : variacionHoy < 0 ? { direction: 'down' as const, pct: Math.abs(variacionHoy).toFixed(1) }
      : { direction: 'flat' as const, pct: '0.0' };

    const trendSemana = variacionSemana === null ? null
      : variacionSemana > 0 ? { direction: 'up' as const, pct: variacionSemana.toFixed(1) }
      : variacionSemana < 0 ? { direction: 'down' as const, pct: Math.abs(variacionSemana).toFixed(1) }
      : { direction: 'flat' as const, pct: '0.0' };

    primaryCards.push(
      { icon: <ShoppingCart size={28} />, label: 'Ventas hoy', value: `$${formatCurrency(metrics.pos.ventasHoy)}`, key: 'pos-hoy', level: 'primary', trend: trendHoy },
      { icon: <CalendarDays size={28} />, label: 'Ventas 7 días', value: `$${formatCurrency(metrics.pos.ventasSemana)}`, key: 'pos-semana', level: 'primary', trend: trendSemana },
    );
  }

  if (metrics?.socios) {
    const cuotasVencidas = metrics.socios.cuotasVencidas;
    standardCards.push(
      { icon: <Users size={cardIconSize} />, label: 'Socios activos', value: String(metrics.socios.activos), key: 'socios', level: 'standard' },
      { icon: <CalendarX size={cardIconSize} />, label: 'Cuotas vencidas', value: String(cuotasVencidas), key: 'cuotas', level: 'standard', alert: cuotasVencidas > 0 ? 'danger' : undefined },
    );
  }

  if (metrics?.acreedores) {
    const deudaTotal = metrics.acreedores.deudaTotal;
    standardCards.push(
      { icon: <UserMinus size={cardIconSize} />, label: 'Acreedores con deuda', value: String(metrics.acreedores.activos), key: 'acreedores', level: 'standard' },
      { icon: <Clock size={cardIconSize} />, label: 'Deuda total', value: `$${formatCurrency(deudaTotal)}`, key: 'deuda', level: 'standard', alert: deudaTotal > 0 ? 'warning' : undefined },
    );
  }

  if (metrics?.internet) {
    const vencenHoy = metrics.internet.vouchersVencenHoy;
    standardCards.push(
      { icon: <Ticket size={cardIconSize} />, label: 'Vouchers activos', value: String(metrics.internet.vouchersActivos), key: 'vouchers', level: 'standard' },
      { icon: <AlertCircle size={cardIconSize} />, label: 'Vencen hoy', value: String(vencenHoy), key: 'vouchers-hoy', level: 'standard', alert: vencenHoy > 0 ? 'warning' : undefined },
    );
  }

  if (metrics?.stock) {
    secondaryCards.push(
      { icon: <Package size={cardIconSize} />, label: 'Productos', value: String(metrics.stock.productos), key: 'productos', level: 'secondary' },
      { icon: <FolderOpen size={cardIconSize} />, label: 'Categorías', value: String(metrics.stock.categorias), key: 'categorias', level: 'secondary' },
    );
  }

  const renderTrend = (trend?: CardData['trend']) => {
    if (!trend) return null;
    if (trend.direction === 'flat') {
      return (
        <span className="home-card-trend home-card-trend--flat">
          Sin cambios
        </span>
      );
    }
    const isUp = trend.direction === 'up';
    return (
      <span className={`home-card-trend ${isUp ? 'home-card-trend--up' : 'home-card-trend--down'}`}>
        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {trend.pct}%
      </span>
    );
  };

  const renderCard = (card: CardData) => (
    <div
      key={card.key}
      className={`home-card home-card--${card.level}${card.alert ? ` home-card--alert-${card.alert}` : ''}`}
    >
      <span className={`home-card-icon${card.alert ? ` home-card-icon--alert-${card.alert}` : ''}`}>
        {card.icon}
      </span>
      <span className={`home-card-value${card.alert ? ` home-card-value--alert-${card.alert}` : ''}`}>
        {card.value}
      </span>
      {renderTrend(card.trend)}
      <span className="home-card-label">{card.label}</span>
    </div>
  );

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

      {!isLoading && primaryCards.length === 0 && standardCards.length === 0 && secondaryCards.length === 0 && (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
          No hay información disponible
        </p>
      )}

      {!isLoading && primaryCards.length > 0 && (
        <div className="home-grid home-grid--primary">
          {primaryCards.map(renderCard)}
        </div>
      )}

      {!isLoading && standardCards.length > 0 && (
        <div className="home-grid home-grid--standard">
          {standardCards.map(renderCard)}
        </div>
      )}

      {!isLoading && secondaryCards.length > 0 && (
        <div className="home-grid home-grid--secondary">
          {secondaryCards.map(renderCard)}
        </div>
      )}
    </div>
  );
};

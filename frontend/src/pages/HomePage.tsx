import { AlertCircle, CalendarDays, CalendarX, Clock, FolderOpen, Package, ShoppingCart, Ticket, UserMinus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { buildImageUrl } from '../api/client';
import { useSettings } from '../api/queries';
import { useHomeMetrics } from '../hooks/useHomeMetrics';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getInitials = (name?: string | null) => {
  if (!name) return 'MP';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'MP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const HomePage: React.FC = () => {
  const { data: settings } = useSettings();
  const { data: metrics, isLoading } = useHomeMetrics();

  const clubName = settings?.clubName || settings?.storeName || 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const initials = getInitials(clubName);

  const cards: { icon: ReactNode; label: string; value: string; key: string }[] = [];

  const cardIconSize = 24;

  if (metrics?.pos) {
    cards.push(
      { icon: <ShoppingCart size={cardIconSize} />, label: 'Ventas hoy', value: `$${formatCurrency(metrics.pos.ventasHoy)}`, key: 'pos-hoy' },
      { icon: <CalendarDays size={cardIconSize} />, label: 'Ventas 7 días', value: `$${formatCurrency(metrics.pos.ventasSemana)}`, key: 'pos-semana' },
    );
  }

  if (metrics?.socios) {
    cards.push(
      { icon: <Users size={cardIconSize} />, label: 'Socios activos', value: String(metrics.socios.activos), key: 'socios' },
      { icon: <CalendarX size={cardIconSize} />, label: 'Cuotas vencidas', value: String(metrics.socios.cuotasVencidas), key: 'cuotas' },
    );
  }

  if (metrics?.acreedores) {
    cards.push(
      { icon: <UserMinus size={cardIconSize} />, label: 'Acreedores con deuda', value: String(metrics.acreedores.activos), key: 'acreedores' },
      { icon: <Clock size={cardIconSize} />, label: 'Deuda total', value: `$${formatCurrency(metrics.acreedores.deudaTotal)}`, key: 'deuda' },
    );
  }

  if (metrics?.internet) {
    cards.push(
      { icon: <Ticket size={cardIconSize} />, label: 'Vouchers activos', value: String(metrics.internet.vouchersActivos), key: 'vouchers' },
      { icon: <AlertCircle size={cardIconSize} />, label: 'Vencen hoy', value: String(metrics.internet.vouchersVencenHoy), key: 'vouchers-hoy' },
    );
  }

  if (metrics?.stock) {
    cards.push(
      { icon: <Package size={cardIconSize} />, label: 'Productos', value: String(metrics.stock.productos), key: 'productos' },
      { icon: <FolderOpen size={cardIconSize} />, label: 'Categorías', value: String(metrics.stock.categorias), key: 'categorias' },
    );
  }

  return (
    <div className="home-page">
      <div className="home-brand">
        {logoUrl ? (
          <img src={logoUrl} alt={clubName} className="home-logo" />
        ) : (
          <div className="home-logo-placeholder">{initials}</div>
        )}
        <h1 className="home-club-name">{clubName}</h1>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
          Cargando métricas...
        </p>
      )}

      {!isLoading && cards.length === 0 && (
        <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '2rem' }}>
          No hay información disponible
        </p>
      )}

      {!isLoading && cards.length > 0 && (
        <div className="home-grid">
          {cards.map((card) => (
            <div key={card.key} className="home-card">
              <span className="home-card-icon">{card.icon}</span>
              <span className="home-card-value">{card.value}</span>
              <span className="home-card-label">{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import { useMemo } from 'react';
import { buildImageUrl } from '../api/client';
import {
  useSocios,
  useAcreedores,
  useSettings,
  useCategories,
  useAdminProducts,
  useInternetStats,
} from '../api/queries';

const getInitials = (name?: string | null) => {
  if (!name) return 'MP';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'MP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

interface MetricCard {
  icon: string;
  value: number | string;
  label: string;
  key: string;
}

export const HomePage: React.FC = () => {
  const { data: settings } = useSettings();
  const { data: socios } = useSocios();
  const { data: acreedores } = useAcreedores();
  const { data: categories } = useCategories();
  const { data: products } = useAdminProducts();
  const { data: internetStats } = useInternetStats();

  const clubName = settings?.clubName || settings?.storeName || 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const initials = getInitials(clubName);

  const metrics = useMemo<MetricCard[]>(() => {
    const cards: MetricCard[] = [];

    if (socios) {
      const activos = socios.filter((s) => s.estado === 'ACTIVO').length;
      cards.push({
        icon: '🪪',
        value: activos,
        label: 'Socios activos',
        key: 'socios',
      });
    }

    if (acreedores) {
      const activos = acreedores.filter((a) => a.activo).length;
      if (activos > 0 || settings?.enableAcreedoresModule) {
        cards.push({
          icon: '👥',
          value: activos,
          label: 'Acreedores activos',
          key: 'acreedores',
        });
      }
    }

    if (products) {
      cards.push({
        icon: '📦',
        value: products.length,
        label: 'Productos',
        key: 'productos',
      });
    }

    if (categories) {
      cards.push({
        icon: '🗂️',
        value: categories.length,
        label: 'Categorías',
        key: 'categorias',
      });
    }

    if (internetStats && settings?.enableInternetModule) {
      cards.push({
        icon: '📶',
        value: internetStats.active_vouchers,
        label: 'Vouchers activos',
        key: 'internet',
      });
    }

    return cards;
  }, [socios, acreedores, categories, products, internetStats, settings]);

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

      <div className="home-grid">
        {metrics.map((card) => (
          <div key={card.key} className="home-card">
            <span className="home-card-icon">{card.icon}</span>
            <span className="home-card-value">{card.value}</span>
            <span className="home-card-label">{card.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

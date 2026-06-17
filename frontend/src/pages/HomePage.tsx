import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ModuleKey } from '../api/types';

const MODULES: {
  key: ModuleKey;
  label: string;
  icon: string;
  route: string;
  description: string;
}[] = [
  { key: 'POS', label: 'POS', icon: '🛒', route: '/', description: 'Punto de venta' },
  { key: 'SOCIOS', label: 'Socios', icon: '🪪', route: '/admin/socios', description: 'Padrón de socios y cuotas' },
  { key: 'TESORERIA', label: 'Tesorería', icon: '📒', route: '/admin/tesoreria', description: 'Contabilidad y libro diario' },
  { key: 'ACREEDORES', label: 'Acreedores', icon: '👥', route: '/admin/acreedores', description: 'Fiado y cuentas corrientes' },
  { key: 'INTERNET', label: 'Internet', icon: '📶', route: '/admin/internet', description: 'Vouchers WiFi' },
  { key: 'STOCK', label: 'Stock', icon: '📐', route: '/admin/stock', description: 'Control de inventario' },
  { key: 'REPORTES', label: 'Reportes', icon: '📊', route: '/admin/stats', description: 'Estadísticas y reportes' },
  { key: 'CONFIGURACION', label: 'Configuración', icon: '⚙️', route: '/admin/settings', description: 'Ajustes del sistema' },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { permissions, user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const hasAccess = (key: ModuleKey): boolean => {
    if (isAdmin) return true;
    return permissions.some((p) => p.module === key && p.access !== 'HIDDEN');
  };

  const visibleModules = MODULES.filter((m) => hasAccess(m.key));

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>Bienvenido, {user?.username ?? 'Usuario'}</h1>
        <p>Seleccioná un módulo para comenzar</p>
      </div>
      <div className="home-grid">
        {visibleModules.map((mod) => (
          <button
            key={mod.key}
            type="button"
            className="home-card"
            onClick={() => navigate(mod.route)}
          >
            <span className="home-card-icon">{mod.icon}</span>
            <span className="home-card-label">{mod.label}</span>
            <span className="home-card-desc">{mod.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import { useSettings } from '../api/queries';
import { AppLayout } from '../components/AppLayout';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useAuth } from '../context/AuthContext';

const COLLAPSE_BREAKPOINT = 1200;
const STORAGE_KEY = 'admin-sidebar-collapsed';

const getInitials = (name?: string | null) => {
  if (!name) return 'MP';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'MP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const navIcon = (emoji: string) => <span className="nav-icon" aria-hidden="true">{emoji}</span>;

interface NavItem {
  to: string;
  emoji: string;
  label: string;
  moduleKey?: 'enableSociosModule' | 'enableTreasuryModule' | 'enableAcreedoresModule' | 'enableInternetModule';
  permissionModule?: string;
}

const navItems: NavItem[] = [
  { to: '/admin/sales',      emoji: '📋', label: 'Ventas',          permissionModule: 'REPORTES' },
  { to: '/admin/stats',      emoji: '📊', label: 'Estadisticas',     permissionModule: 'REPORTES' },
  { to: '/admin/tesoreria',  emoji: '📒', label: 'Tesorería',       moduleKey: 'enableTreasuryModule', permissionModule: 'TESORERIA' },
  { to: '/admin/categories', emoji: '🗂️', label: 'Categorias',       permissionModule: 'CONFIGURACION' },
  { to: '/admin/products',   emoji: '📦', label: 'Productos',        permissionModule: 'CONFIGURACION' },
  { to: '/admin/stock',      emoji: '📐', label: 'Stock',            permissionModule: 'STOCK' },
  { to: '/admin/acreedores', emoji: '👥', label: 'Acreedores',      moduleKey: 'enableAcreedoresModule', permissionModule: 'ACREEDORES' },
  { to: '/admin/socios',     emoji: '🪪', label: 'Socios',          moduleKey: 'enableSociosModule', permissionModule: 'SOCIOS' },
  { to: '/admin/internet',   emoji: '📶', label: 'Internet',        moduleKey: 'enableInternetModule', permissionModule: 'INTERNET' },
  { to: '/admin/users',      emoji: '👤', label: 'Usuarios',        permissionModule: 'CONFIGURACION' },
  { to: '/admin/settings',   emoji: '⚙️', label: 'Configuracion',    permissionModule: 'CONFIGURACION' },
];

export const AdminLayout: React.FC = () => {
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;

  const moduleAccess = useModuleAccess;

  const prevWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : COLLAPSE_BREAKPOINT + 1
  );

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth <= COLLAPSE_BREAKPOINT;
  });

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const prevWidth = prevWidthRef.current;
      prevWidthRef.current = currentWidth;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return;

      const crossingDown = prevWidth > COLLAPSE_BREAKPOINT && currentWidth <= COLLAPSE_BREAKPOINT;
      const crossingUp = prevWidth <= COLLAPSE_BREAKPOINT && currentWidth > COLLAPSE_BREAKPOINT;

      if (crossingDown) {
        setIsCollapsed(true);
      } else if (crossingUp) {
        setIsCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (item.moduleKey) {
      const key = item.moduleKey;
      const settingVal = settings?.[key];
      if (settingVal === false) return false;
    }
    if (!isAdmin && item.permissionModule) {
      const access = moduleAccess(item.permissionModule as any);
      if (access === 'HIDDEN') return false;
    }
    return true;
  });

  return (
    <AppLayout title="">
      <div className="admin-layout">
        <nav className={`admin-sidebar${isCollapsed ? ' is-collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              {showLogo ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="sidebar-logo"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="sidebar-logo-placeholder" aria-hidden="true">
                  {initials}
                </div>
              )}
              {!isCollapsed && <span className="sidebar-brand-name">{storeName}</span>}
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              <span aria-hidden="true">{isCollapsed ? '▶' : '◀'}</span>
            </button>
          </div>

          {filteredNavItems.map(({ to, emoji, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'active' : ''}
              title={isCollapsed ? label : undefined}
            >
              {navIcon(emoji)}
              {!isCollapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
};

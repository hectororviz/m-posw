import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import { useSettings } from '../api/queries';
import { AppLayout } from '../components/AppLayout';

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

const navItems = [
  { to: '/admin/sales',      emoji: '📋', label: 'Ventas' },
  { to: '/admin/stats',      emoji: '📊', label: 'Estadisticas' },
  { to: '/admin/tesoreria',  emoji: '📒', label: 'Tesorería',     moduleKey: 'enableTreasuryModule' as const },
  { to: '/admin/categories', emoji: '🗂️', label: 'Categorias' },
  { to: '/admin/products',   emoji: '📦', label: 'Productos' },
  { to: '/admin/stock',      emoji: '📐', label: 'Stock' },
  { to: '/admin/acreedores', emoji: '👥', label: 'Acreedores',    moduleKey: 'enableAcreedoresModule' as const },
  { to: '/admin/socios',     emoji: '🪪', label: 'Socios',        moduleKey: 'enableSociosModule' as const },
  { to: '/admin/settings',   emoji: '⚙️', label: 'Configuracion' },
];

export const AdminLayout: React.FC = () => {
  const { data: settings } = useSettings();
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;

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

          {navItems
            .filter((item) => {
              if (!item.moduleKey) return true;
              const key = item.moduleKey as 'enableSociosModule' | 'enableTreasuryModule' | 'enableAcreedoresModule';
              return settings?.[key] ?? true;
            })
            .map(({ to, emoji, label }) => (
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

import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import type { Setting } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface AppHeaderProps {
  settings?: Setting;
  isLoading: boolean;
}

const getInitials = (name?: string | null) => {
  if (!name) {
    return 'MP';
  }
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) {
    return 'MP';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const AppHeader: React.FC<AppHeaderProps> = ({ settings, isLoading }) => {
  const { user, logout } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const showSkeleton = isLoading && !settings;
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;
  const isPosScreen = location.pathname === '/pos' || location.pathname.startsWith('/category/');
  const isAdminScreen = location.pathname.startsWith('/admin');
  const isSalesScreen = location.pathname === '/sales';
  const showConfigToggle = user?.role === 'ADMIN' && (isPosScreen || isAdminScreen);
  const showSalesButton = user?.role !== 'ADMIN';

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  return (
    <header className="app-header">
      <div className="header-row">
        <div className="brand-block">
          {showLogo ? (
            <img src={logoUrl} alt={storeName} className="brand-logo" onError={() => setLogoError(true)} />
          ) : (
            <div className="logo-placeholder" aria-hidden="true">
              {initials}
            </div>
          )}
          <div className="brand-text">
            {showSkeleton ? (
              <span className="text-skeleton" aria-hidden="true" />
            ) : (
              <span className="store-name" title={storeName}>
                {storeName}
              </span>
            )}
          </div>
        </div>
        <div className="header-user">
          <span className="user-name" title={user?.username ?? 'Usuario'}>
            {user?.username ?? 'Usuario'}
          </span>
          <button type="button" onClick={toggleTheme} className="ghost-button header-toggle-button theme-toggle" aria-label="Cambiar tema" title={resolved === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
            <span aria-hidden="true">{resolved === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          {showSalesButton && (
            <NavLink
              to={isSalesScreen ? '/pos' : '/sales'}
              className="ghost-button sales-toggle-button"
              aria-label={isSalesScreen ? 'Volver al POS' : 'Movimientos'}
            >
              {isSalesScreen ? 'POS' : 'Movimientos'}
            </NavLink>
          )}
          {showConfigToggle && (
            <NavLink
              to={isPosScreen ? '/admin/settings' : '/pos'}
              className="ghost-button header-toggle-button"
              aria-label={isPosScreen ? 'Configuración' : 'Volver a POS'}
            >
              <span aria-hidden="true">{isPosScreen ? '⚙️' : '$'}</span>
            </NavLink>
          )}
          <button type="button" onClick={logout} className="ghost-button logout-button" aria-label="Salir">
            <span className="logout-icon" aria-hidden="true">
              ⎋
            </span>
            <span className="logout-text">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};

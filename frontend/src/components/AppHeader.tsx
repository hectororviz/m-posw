import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { buildImageUrl } from '../api/client';
import type { Setting } from '../api/types';
import { useAuth } from '../context/AuthContext';

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
  const location = useLocation();
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const showSkeleton = isLoading && !settings;
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;
  const isPosScreen = location.pathname === '/' || location.pathname.startsWith('/category/');
  const isAdminScreen = location.pathname.startsWith('/admin');
  const showConfigToggle = user?.role === 'ADMIN' && (isPosScreen || isAdminScreen);

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
          <span className="user-name" title={user?.name ?? 'Usuario'}>
            {user?.name ?? 'Usuario'}
          </span>
          {showConfigToggle && (
            <NavLink
              to={isPosScreen ? '/admin/settings' : '/'}
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

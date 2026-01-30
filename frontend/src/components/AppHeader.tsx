import { NavLink } from 'react-router-dom';
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
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const showSkeleton = isLoading && !settings;
  const initials = getInitials(storeName);

  return (
    <header className="app-header">
      <div className="header-row">
        <div className="brand-block">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="brand-logo" />
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
          <button type="button" onClick={logout} className="ghost-button logout-button" aria-label="Salir">
            <span className="logout-icon" aria-hidden="true">
              ⎋
            </span>
            <span className="logout-text">Salir</span>
          </button>
        </div>
      </div>
      <nav className="app-nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          POS
        </NavLink>
        <NavLink to="/checkout" className={({ isActive }) => (isActive ? 'active' : '')}>
          Venta
        </NavLink>
        {user?.role === 'ADMIN' && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            Admin
          </NavLink>
        )}
      </nav>
    </header>
  );
};

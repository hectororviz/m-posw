import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, LogOut, Menu, MessageCircle, Moon, Settings, Sun } from 'lucide-react';
import { buildImageUrl } from '../api/client';
import type { Setting } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';

interface AppHeaderProps {
  settings?: Setting;
  isLoading: boolean;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
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

export const AppHeader: React.FC<AppHeaderProps> = ({ settings, isLoading, showMenuButton, onMenuClick }) => {
  const { user, logout, permissions } = useAuth();
  const { resolved, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const showSkeleton = isLoading && !settings;
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;
  const isPosScreen = location.pathname === '/pos' || location.pathname.startsWith('/category/');
  const isHomeScreen = location.pathname === '/home';
  const isAdminScreen = location.pathname.startsWith('/admin');
  const isSalesScreen = location.pathname === '/sales';
  const isAdmin = user?.role === 'ADMIN';
  const hasAdminAccess = useMemo(() => {
    if (isAdmin) return true;
    return permissions.some((p) => p.access !== 'HIDDEN' && p.module !== 'POS');
  }, [isAdmin, permissions]);
  const { data: unreadData } = useUnreadCount();
  const unreadTotal = unreadData?.total ?? 0;
  const notifAccess = useModuleAccess('NOTIFICACIONES');
  const notifEnabled = settings?.enableNotificationsModule !== false;
  const showNotifButton = notifEnabled && notifAccess !== 'HIDDEN';

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  return (
    <header className="app-header">
      <div className="header-row">
        {showMenuButton && (
          <button
            type="button"
            className="ghost-button header-toggle-button admin-menu-button"
            onClick={onMenuClick}
            aria-label="Abrir menú"
            title="Abrir menú"
          >
            <Menu size={18} />
          </button>
        )}
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
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {showNotifButton && (
            <button
              type="button"
              onClick={() => navigate('/admin/notificaciones?tab=conversaciones')}
              className="ghost-button header-toggle-button"
              aria-label="Notificaciones WhatsApp"
              title="Conversaciones WhatsApp"
              style={{ position: 'relative' }}
            >
              <MessageCircle size={18} />
              {unreadTotal > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '50%',
                  minWidth: 16,
                  height: 16,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid var(--color-surface)',
                  padding: '0 3px',
                  lineHeight: 1,
                  boxSizing: 'border-box',
                }}>
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </button>
          )}
          {!isAdmin && hasAdminAccess && (
            <NavLink
              to={isAdminScreen || isHomeScreen ? '/pos' : '/home'}
              className="ghost-button sales-toggle-button"
            >
              {isAdminScreen || isHomeScreen ? 'POS' : 'Admin'}
            </NavLink>
          )}
          {!isAdmin && !hasAdminAccess && (
            <NavLink
              to={isSalesScreen ? '/pos' : '/sales'}
              className="ghost-button sales-toggle-button"
            >
              {isSalesScreen ? 'POS' : 'Movimientos'}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to={isPosScreen || isHomeScreen ? '/admin/settings' : '/pos'}
              className="ghost-button header-toggle-button"
            >
              {isPosScreen || isHomeScreen ? <Settings size={18} /> : <DollarSign size={18} />}
            </NavLink>
          )}
          <button type="button" onClick={logout} className="ghost-button logout-button" aria-label="Salir">
            <LogOut size={18} className="logout-icon" />
            <span className="logout-text">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};

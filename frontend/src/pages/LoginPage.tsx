import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useSettings } from '../api/queries';
import type { AuthResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { data: settings } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeName = settings?.storeName ?? 'm-POSw';
  const clubName = settings?.clubName ?? '';
  const logoUrl = buildImageUrl(settings?.logoUrl);

  const getInitials = (name?: string | null) => {
    if (!name) return 'MP';
    const words = name.trim().split(' ').filter(Boolean);
    if (words.length === 0) return 'MP';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', { username, password });
      login(response.data);

      const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
      const smartphoneModule = isMobile ? response.data.homeSmartphoneModule : null;

      if (smartphoneModule) {
        const route = getSmartphoneRoute(smartphoneModule);
        if (route) {
          navigate(route, { replace: true });
          return;
        }
      }

      const homeModule = response.data.homeModule;
      if (homeModule) {
        const route = getModuleRoute(homeModule);
        if (route) {
          navigate(route, { replace: true });
          return;
        }
      }
      if (response.data.user.role === 'ADMIN') {
        navigate('/admin/home', { replace: true });
      } else {
        navigate('/admin/home', { replace: true });
      }
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="login-logo" />
          ) : (
            <div className="login-logo-placeholder">{getInitials(storeName)}</div>
          )}
          <div className="login-brand-text">
            <h1 className="login-store-name">{storeName}</h1>
            {clubName && <p className="login-club-name">{clubName}</p>}
          </div>
        </div>

        <div className="login-field">
          <label className="login-label">Usuario</label>
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nombre de usuario"
            autoComplete="username"
            required
          />
        </div>

        <div className="login-field">
          <label className="login-label">Contraseña</label>
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          type="submit"
          className="login-submit"
          disabled={loading || !username || !password}
        >
          {loading ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

function getModuleRoute(moduleKey: string): string | null {
  const map: Record<string, string> = {
    POS: '/pos',
    VENTAS: '/admin/sales',
    SOCIOS: '/admin/socios',
    TESORERIA: '/admin/tesoreria',
    ACREEDORES: '/admin/acreedores',
    PRODUCTOS: '/admin/products',
    INTERNET: '/admin/internet',
    PLAYERS: '/admin/players',
    REPORTES: '/admin/stats',
    CONFIGURACION: '/admin/settings',
  };
  return map[moduleKey] ?? null;
}

function getSmartphoneRoute(moduleKey: string): string | null {
  const map: Record<string, string> = {
    TESORERIA: '/admin/tesoreria/gastos',
    POS: '/pos',
    VENTAS: '/admin/sales',
  };
  return map[moduleKey] ?? null;
}

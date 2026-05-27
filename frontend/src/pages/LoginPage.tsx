import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useLoginUsers, useSettings } from '../api/queries';
import type { AuthResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

const DEFAULT_ACCENT_COLOR = 'var(--color-accent)';

const getInitials = (name?: string | null) => {
  if (!name) return 'MP';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'MP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { data: settings } = useSettings();
  const { data: users, isLoading: usersLoading, error: usersError } = useLoginUsers();
  const [identifier, setIdentifier] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const { showEmbeddedKeyboard } = useEmbeddedKeyboard();
  const [pinFocused, setPinFocused] = useState(false);
  const pinLength = 6;

  useEffect(() => {
    const accentColor = settings?.accentColor?.trim();
    document.documentElement.style.setProperty('--accent-color', accentColor || DEFAULT_ACCENT_COLOR);
  }, [settings?.accentColor]);

  const storeName = settings?.storeName ?? 'm-POSw';
  const clubName = settings?.clubName ?? '';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const showLogo = Boolean(logoUrl) && !logoError;
  const initials = getInitials(storeName);

  useEffect(() => { setLogoError(false); }, [logoUrl]);

  const availableUsers = useMemo(() => (users ?? []).filter((u) => u.active !== false), [users]);

  const handleUserChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(event.target.value);
    setIdentifier('');
    setPin('');
  };

  const appendDigit = (digit: string) => {
    setPin((c) => (c + digit).slice(0, pinLength));
  };

  const handleBackspace = () => setPin((c) => c.slice(0, -1));
  const handleClear = () => setPin('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const selectedUser = availableUsers.find((u) => u.id === selectedUserId);
      const payload = selectedUser?.email
        ? { email: selectedUser.email, pin }
        : selectedUser
          ? { name: selectedUser.name, pin }
          : identifier.includes('@')
            ? { email: identifier, pin }
            : { name: identifier, pin };
      const response = await apiClient.post<AuthResponse>('/auth/login', payload);
      login(response.data);
      if (response.data.user.role === 'ADMIN') {
        navigate('/admin/sales', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const usersLoadError = usersError ? normalizeApiError(usersError) : null;

  return (
    <div className="login-page">
      <div className="login-bg" />
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          {showLogo ? (
            <img src={logoUrl} alt={storeName} className="login-logo" onError={() => setLogoError(true)} />
          ) : (
            <div className="login-logo-placeholder">{initials}</div>
          )}
          <div className="login-brand-text">
            <h1 className="login-store-name">{storeName}</h1>
            {clubName && <p className="login-club-name">{clubName}</p>}
          </div>
        </div>

        <div className="login-field">
          <label className="login-label">Usuario</label>
          {availableUsers.length > 0 ? (
            <select className="login-select" value={selectedUserId} onChange={handleUserChange} required>
              <option value="" disabled>
                {usersLoading ? 'Cargando...' : 'Selecciona un usuario'}
              </option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}{user.email ? ` — ${user.email}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="login-input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email o nombre de usuario"
              required
            />
          )}
          {usersLoadError && <p className="error-text">{usersLoadError}</p>}
        </div>

        <div className="login-field">
          <label className="login-label">PIN</label>
          <div className={`login-pin-display ${pinFocused ? 'focused' : ''}`} onClick={() => setPinFocused(true)}>
            {Array.from({ length: pinLength }).map((_, i) => (
              <span key={i} className={`login-pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </div>
          <input
            className="login-pin-hidden"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, pinLength);
              setPin(v);
            }}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            maxLength={pinLength}
            autoComplete="off"
          />
        </div>

        <div className={`login-keypad ${showEmbeddedKeyboard ? '' : 'login-keypad--hidden'}`}>
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button key={d} type="button" className="login-key" onClick={() => appendDigit(d)}>{d}</button>
          ))}
          <button type="button" className="login-key login-key--clear" onClick={handleClear}>Limpiar</button>
          <button type="button" className="login-key" onClick={() => appendDigit('0')}>0</button>
          <button type="button" className="login-key login-key--back" onClick={handleBackspace}>⌫</button>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          type="submit"
          className="login-submit"
          disabled={loading || pin.length < pinLength || (availableUsers.length > 0 ? !selectedUserId : !identifier)}
        >
          {loading ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

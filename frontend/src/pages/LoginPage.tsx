import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, buildImageUrl, normalizeApiError } from '../api/client';
import { useLoginUsers, useSettings } from '../api/queries';
import type { AuthResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useEmbeddedKeyboard } from '../hooks/useEmbeddedKeyboard';

const DEFAULT_ACCENT_COLOR = '#f59e0b';

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
  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
  } = useLoginUsers();
  const [identifier, setIdentifier] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTempKeyboard, setShowTempKeyboard] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { showEmbeddedKeyboard } = useEmbeddedKeyboard();
  const pinLength = 6;

  const shouldShowKeyboard = showEmbeddedKeyboard || showTempKeyboard;

  useEffect(() => {
    const accentColor = settings?.accentColor?.trim();
    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor);
      return;
    }
    document.documentElement.style.setProperty('--accent-color', DEFAULT_ACCENT_COLOR);
  }, [settings?.accentColor]);

  const storeName = settings?.storeName ?? 'm-POSw';
  const clubName = settings?.clubName ?? '';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const showLogo = Boolean(logoUrl) && !logoError;
  const initials = getInitials(storeName);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const availableUsers = useMemo(
    () => (users ?? []).filter((user) => user.active !== false),
    [users],
  );

  const handleUserChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUserId(event.target.value);
    setIdentifier('');
    setPin('');
  };

  const handlePinChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, pinLength);
    setPin(sanitized);
  };

  const appendDigit = (digit: string) => {
    setPin((current) => (current + digit).slice(0, pinLength));
  };

  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const selectedUser = availableUsers.find((user) => user.id === selectedUserId);
      const payload =
        selectedUser?.email
          ? { email: selectedUser.email, pin }
          : selectedUser
            ? { name: selectedUser.name, pin }
            : identifier.includes('@')
              ? { email: identifier, pin }
              : { name: identifier, pin };

      const response = await apiClient.post<AuthResponse>('/auth/login', payload);
      login(response.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const usersLoadError = usersError ? normalizeApiError(usersError) : null;

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          {showLogo ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="login-logo"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="login-logo-placeholder">{initials}</div>
          )}
          <h1 className="login-store-name">{storeName}</h1>
          {clubName && <p className="login-club-name">{clubName}</p>}
        </div>
        <h2>Iniciar sesión</h2>
        <label className="field">
          Email o usuario
          {availableUsers.length > 0 ? (
            <select value={selectedUserId} onChange={handleUserChange} required>
              <option value="" disabled>
                {usersLoading ? 'Cargando usuarios...' : 'Seleccione un usuario'}
              </option>
              {availableUsers.map((user) => {
                const emailLabel = user.email ? ` - ${user.email}` : '';
                const label = user.externalPosId
                  ? `${user.name} (${user.externalPosId})${emailLabel}`
                  : `${user.name}${emailLabel}`;
                return (
                  <option key={user.id} value={user.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={usersLoading ? 'Cargando usuarios...' : 'Ingrese su email o usuario'}
              required
            />
          )}
          {usersLoadError && <p className="error-text">{usersLoadError}</p>}
        </label>
        <label className="field">
          PIN
          <input
            type="password"
            value={pin}
            onChange={(event) => handlePinChange(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="••••••"
            maxLength={pinLength}
            required
          />
        </label>
        {!showEmbeddedKeyboard && (
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: '0.5rem', width: 'auto' }}
            onClick={() => setShowTempKeyboard(!showTempKeyboard)}
          >
            {showTempKeyboard ? 'Ocultar teclado' : 'Mostrar teclado'}
          </button>
        )}
        {shouldShowKeyboard && (
          <div className="pin-keypad" aria-label="Teclado numérico">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                className="pin-key"
                onClick={() => appendDigit(digit)}
              >
                {digit}
              </button>
            ))}
            <button type="button" className="pin-key pin-key--secondary" onClick={handleClear}>
              Limpiar
            </button>
            <button type="button" className="pin-key" onClick={() => appendDigit('0')}>
              0
            </button>
            <button type="button" className="pin-key pin-key--secondary" onClick={handleBackspace}>
              Borrar
            </button>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <button
          type="submit"
          className="primary-button"
          disabled={
            loading ||
            pin.length < pinLength ||
            (availableUsers.length > 0 ? !selectedUserId : !identifier)
          }
        >
          {loading ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

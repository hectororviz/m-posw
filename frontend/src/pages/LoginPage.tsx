import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';
import type { AuthResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', { username, password });
      login(response.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card" onSubmit={handleSubmit}>
        <h2>Iniciar sesión</h2>
        <label className="field">
          Usuario
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Caja01"
            required
          />
        </label>
        <label className="field">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••"
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Ingresando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

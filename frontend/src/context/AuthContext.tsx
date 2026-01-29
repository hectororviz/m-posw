import { createContext, useContext, useMemo, useState } from 'react';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storageKey = 'authToken';
const storageUserKey = 'authUser';

const loadAuthState = (): AuthState => {
  const token = localStorage.getItem(storageKey);
  const userRaw = localStorage.getItem(storageUserKey);
  const user = userRaw ? (JSON.parse(userRaw) as User) : null;
  return { token, user };
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => loadAuthState());

  const login = (response: AuthResponse) => {
    localStorage.setItem(storageKey, response.accessToken);
    localStorage.setItem(storageUserKey, JSON.stringify(response.user));
    setState({ token: response.accessToken, user: response.user });
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(storageUserKey);
    setState({ token: null, user: null });
  };

  const value = useMemo(() => ({ ...state, login, logout }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

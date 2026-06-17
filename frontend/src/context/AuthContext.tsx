import { createContext, useContext, useMemo, useState } from 'react';
import type { AuthResponse, ModulePermission, User } from '../api/types';

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: ModulePermission[];
  homeModule: string | null;
}

interface AuthContextValue extends AuthState {
  login: (response: AuthResponse) => void;
  logout: () => void;
  setPermissions: (permissions: ModulePermission[]) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const storageKey = 'authToken';
const storageUserKey = 'authUser';
const storagePermissionsKey = 'authPermissions';
const storageHomeModuleKey = 'authHomeModule';

const loadAuthState = (): AuthState => {
  const token = localStorage.getItem(storageKey);
  const userRaw = localStorage.getItem(storageUserKey);
  const permissionsRaw = localStorage.getItem(storagePermissionsKey);
  const homeModule = localStorage.getItem(storageHomeModuleKey);
  const user = userRaw ? (JSON.parse(userRaw) as User) : null;
  const permissions = permissionsRaw ? (JSON.parse(permissionsRaw) as ModulePermission[]) : [];
  return { token, user, permissions, homeModule };
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => loadAuthState());

  const login = (response: AuthResponse) => {
    localStorage.setItem(storageKey, response.accessToken);
    localStorage.setItem(storageUserKey, JSON.stringify(response.user));
    localStorage.setItem(storagePermissionsKey, JSON.stringify(response.permissions));
    if (response.homeModule) {
      localStorage.setItem(storageHomeModuleKey, response.homeModule);
    } else {
      localStorage.removeItem(storageHomeModuleKey);
    }
    setState({
      token: response.accessToken,
      user: response.user,
      permissions: response.permissions,
      homeModule: response.homeModule,
    });
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(storageUserKey);
    localStorage.removeItem(storagePermissionsKey);
    localStorage.removeItem(storageHomeModuleKey);
    setState({ token: null, user: null, permissions: [], homeModule: null });
  };

  const setPermissions = (permissions: ModulePermission[]) => {
    localStorage.setItem(storagePermissionsKey, JSON.stringify(permissions));
    setState((prev) => ({ ...prev, permissions }));
  };

  const value = useMemo(
    () => ({ ...state, login, logout, setPermissions }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

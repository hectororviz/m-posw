import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  title?: string;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ title, children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>{title ?? 'm-POSw'}</h1>
          <p className="subtitle">Tablet-first POS</p>
        </div>
        <div className="header-actions">
          <nav className="header-nav">
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
          <div className="user-chip">
            <span>{user?.name}</span>
            <button type="button" onClick={logout} className="ghost-button">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
};

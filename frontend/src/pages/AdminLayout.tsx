import { NavLink, Outlet } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

export const AdminLayout: React.FC = () => {
  return (
    <AppLayout title="Administración">
      <div className="admin-layout">
        <nav className="admin-sidebar">
          <NavLink to="/admin/sales" className={({ isActive }) => (isActive ? 'active' : '')}>
            Ventas
          </NavLink>
          <NavLink to="/admin/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
            Estadísticas
          </NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? 'active' : '')}>
            Categorías
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'active' : '')}>
            Productos
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            Usuarios
          </NavLink>
          <NavLink to="/admin/stock" className={({ isActive }) => (isActive ? 'active' : '')}>
            Stock
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
        </nav>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
};

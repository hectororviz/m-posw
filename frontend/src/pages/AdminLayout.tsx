import { NavLink, Outlet } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

export const AdminLayout: React.FC = () => {
  return (
    <AppLayout title="Administración">
      <div className="admin-nav">
        <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? 'active' : '')}>
          Categorías
        </NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => (isActive ? 'active' : '')}>
          Productos
        </NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          Settings
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          Usuarios
        </NavLink>
      </div>
      <Outlet />
    </AppLayout>
  );
};

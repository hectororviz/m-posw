import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '../components/Layout';

export const AdminLayout: React.FC = () => {
  return (
    <Layout title="Administración">
      <div className="admin-nav">
        <NavLink to="/admin/categories">Categorías</NavLink>
        <NavLink to="/admin/products">Productos</NavLink>
        <NavLink to="/admin/settings">Settings</NavLink>
        <NavLink to="/admin/users">Usuarios</NavLink>
      </div>
      <Outlet />
    </Layout>
  );
};

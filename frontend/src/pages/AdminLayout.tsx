import { NavLink, Outlet } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

const navIcon = (emoji: string) => <span className="nav-icon" aria-hidden="true">{emoji}</span>;

export const AdminLayout: React.FC = () => {
  return (
    <AppLayout title="">
      <div className="admin-layout">
        <nav className="admin-sidebar">
          <NavLink to="/admin/sales" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('📋')} Ventas
          </NavLink>
          <NavLink to="/admin/stats" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('📊')} Estadisticas
          </NavLink>
          <NavLink to="/admin/contabilidad" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('💰')} Contabilidad
          </NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('🗂️')} Categorias
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('📦')} Productos
          </NavLink>
          <NavLink to="/admin/stock" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('📐')} Stock
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'active' : ''}>
            {navIcon('⚙️')} Configuracion
          </NavLink>
        </nav>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
};


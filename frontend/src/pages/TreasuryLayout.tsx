import { NavLink, Outlet } from 'react-router-dom';

export const TreasuryLayout: React.FC = () => {
  return (
    <div className="treasury-page">
      <nav className="treasury-subnav">
        <NavLink to="/admin/tesoreria" end className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Resumen
        </NavLink>
        <NavLink to="/admin/tesoreria/movimientos" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Movimientos
        </NavLink>
        <NavLink to="/admin/tesoreria/cuentas" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Plan de cuentas
        </NavLink>
        <NavLink to="/admin/tesoreria/reportes" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Reportes
        </NavLink>
        <NavLink to="/admin/tesoreria/gastos" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Gastos
        </NavLink>
        <NavLink to="/admin/tesoreria/configuracion" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Configuración
        </NavLink>
      </nav>
      <div className="treasury-content">
        <Outlet />
      </div>
    </div>
  );
};

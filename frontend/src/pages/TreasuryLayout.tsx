import { NavLink, Outlet } from 'react-router-dom';

export const TreasuryLayout: React.FC = () => {
  return (
    <div className="treasury-page">
      <nav className="treasury-subnav">
        <NavLink to="/admin/tesoreria" end className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Resumen
        </NavLink>
        <NavLink to="/admin/tesoreria/efectivo" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Efectivo
        </NavLink>
        <NavLink to="/admin/tesoreria/auditoria-mp" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Auditoría MP
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

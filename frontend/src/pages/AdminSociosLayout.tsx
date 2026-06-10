import { NavLink, Outlet } from 'react-router-dom';

export const AdminSociosLayout: React.FC = () => {
  return (
    <div className="treasury-page">
      <nav className="treasury-subnav">
        <NavLink to="/admin/socios" end className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Socios
        </NavLink>
        <NavLink to="/admin/socios/matriz" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Matriz
        </NavLink>
        <NavLink to="/admin/socios/configuracion" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Configuracion
        </NavLink>
        <NavLink to="/admin/socios/beneficios" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
          Beneficios
        </NavLink>
      </nav>
      <div className="treasury-content">
        <Outlet />
      </div>
    </div>
  );
};

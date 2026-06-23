import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Tag, Trophy, Users } from 'lucide-react';

export const PlayersLayout: React.FC = () => (
  <div className="treasury-page">
    <nav className="treasury-subnav">
      <NavLink to="/admin/players" end className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
        <LayoutDashboard size={14} /> Dashboard
      </NavLink>
      <NavLink to="/admin/players/jugadores" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
        <Users size={14} /> Jugadores
      </NavLink>
      <NavLink to="/admin/players/categorias" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
        <Tag size={14} /> Categorías
      </NavLink>
      <NavLink to="/admin/players/torneos" className={({ isActive }) => isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'}>
        <Trophy size={14} /> Torneos
      </NavLink>
    </nav>
    <div className="treasury-content">
      <Outlet />
    </div>
  </div>
);

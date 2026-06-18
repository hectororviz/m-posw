import { NavLink, Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useLigasConfigs } from '../api/queries';

export const LigasLayout: React.FC = () => {
  const { data: configs, isLoading } = useLigasConfigs();

  if (isLoading) {
    return (
      <div className="treasury-page">
        <div className="treasury-content">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="treasury-page">
      <nav className="treasury-subnav">
        {(configs ?? []).map((cfg) => (
          <NavLink
            key={cfg.id}
            to={`/admin/ligas/${cfg.id}`}
            className={({ isActive }) =>
              isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'
            }
          >
            {cfg.leagueName}
          </NavLink>
        ))}
        <NavLink
          to="/admin/ligas/configuracion"
          className={({ isActive }) =>
            isActive ? 'treasury-subnav-link active' : 'treasury-subnav-link'
          }
          style={{ marginLeft: 'auto' }}
        >
          <Settings size={14} style={{ marginRight: 4 }} />
          Config
        </NavLink>
      </nav>
      <div className="treasury-content">
        <Outlet />
      </div>
    </div>
  );
};

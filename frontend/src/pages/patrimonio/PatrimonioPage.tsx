import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Boxes, Settings } from 'lucide-react';

const TABS = [
  { id: 'bienes', label: 'Bienes', icon: Boxes },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

export const PatrimonioPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.endsWith('/configuracion') ? 'configuracion' : 'bienes';

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Patrimonio</h2>
      </div>

      <nav className="treasury-subnav" style={{ marginBottom: '1.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`treasury-subnav-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/patrimonio/${tab.id}`)}
          >
            <tab.icon size={16} style={{ marginRight: 6 }} />
            {tab.label}
          </button>
        ))}
      </nav>

      <Outlet />
    </div>
  );
};

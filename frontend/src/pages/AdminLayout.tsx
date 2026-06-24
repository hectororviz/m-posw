import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart2, Boxes, Building2, ChevronDown, ChevronLeft, ChevronRight, House, Landmark, MonitorCog, Package, PenTool, Receipt, Settings, ShoppingCart, Store, Tag, Trophy, UserCog, UserMinus, Users, UsersRound, Wifi } from 'lucide-react';
import { buildImageUrl } from '../api/client';
import { useSettings } from '../api/queries';
import { AppLayout } from '../components/AppLayout';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useAuth } from '../context/AuthContext';

const COLLAPSE_BREAKPOINT = 1200;
const STORAGE_KEY = 'admin-sidebar-collapsed';

const getInitials = (name?: string | null) => {
  if (!name) return 'MP';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return 'MP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const navIcon = (icon: ReactNode) => <span className="nav-icon" aria-hidden="true">{icon}</span>;

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  moduleKey?: 'enableSociosModule' | 'enableTreasuryModule' | 'enableAcreedoresModule' | 'enableInternetModule' | 'enableLigasModule' | 'enablePlayersModule' | 'enablePatrimonioModule';
  permissionModule?: string;
}

interface NavCategoryDef {
  label: string;
  icon: ReactNode;
  children: NavItem[];
}

const iconSize = 18;

const navCategories: NavCategoryDef[] = [
  {
    label: 'Ventas',
    icon: <Store size={iconSize} />,
    children: [
      { to: '/pos',              icon: <ShoppingCart size={iconSize} />, label: 'POS',            permissionModule: 'POS' },
      { to: '/admin/sales',      icon: <Receipt size={iconSize} />,      label: 'Ventas',         permissionModule: 'VENTAS' },
      { to: '/admin/stats',      icon: <BarChart2 size={iconSize} />,    label: 'Estadisticas',   permissionModule: 'REPORTES' },
      { to: '/admin/categories', icon: <Tag size={iconSize} />,          label: 'Categorias',     permissionModule: 'PRODUCTOS' },
      { to: '/admin/products',   icon: <Package size={iconSize} />,      label: 'Productos',      permissionModule: 'PRODUCTOS' },
      { to: '/admin/stock',      icon: <Boxes size={iconSize} />,        label: 'Stock',          permissionModule: 'PRODUCTOS' },
    ],
  },
  {
    label: 'Administracion',
    icon: <Building2 size={iconSize} />,
    children: [
      { to: '/admin/acreedores', icon: <UserMinus size={iconSize} />,   label: 'Acreedores',     moduleKey: 'enableAcreedoresModule', permissionModule: 'ACREEDORES' },
      { to: '/admin/socios',     icon: <Users size={iconSize} />,        label: 'Socios',         moduleKey: 'enableSociosModule',    permissionModule: 'SOCIOS' },
      { to: '/admin/tesoreria',  icon: <Landmark size={iconSize} />,     label: 'Tesorería',      moduleKey: 'enableTreasuryModule',  permissionModule: 'TESORERIA' },
      { to: '/admin/patrimonio', icon: <PenTool size={iconSize} />,      label: 'Patrimonio',     moduleKey: 'enablePatrimonioModule', permissionModule: 'PATRIMONIO' },
    ],
  },
  {
    label: 'Deportes',
    icon: <Trophy size={iconSize} />,
    children: [
      { to: '/admin/ligas',     icon: <Trophy size={iconSize} />,       label: 'Ligas',          moduleKey: 'enableLigasModule',    permissionModule: 'LIGAS' },
      { to: '/admin/players',   icon: <UsersRound size={iconSize} />,   label: 'Jugadores',      moduleKey: 'enablePlayersModule',  permissionModule: 'PLAYERS' },
    ],
  },
  {
    label: 'Sistema',
    icon: <MonitorCog size={iconSize} />,
    children: [
      { to: '/admin/internet',  icon: <Wifi size={iconSize} />,         label: 'Internet',       moduleKey: 'enableInternetModule', permissionModule: 'INTERNET' },
      { to: '/admin/users',     icon: <UserCog size={iconSize} />,       label: 'Usuarios',       permissionModule: 'CONFIGURACION' },
      { to: '/admin/settings',  icon: <Settings size={iconSize} />,      label: 'Configuracion',  permissionModule: 'CONFIGURACION' },
    ],
  },
];

export const AdminLayout: React.FC = () => {
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const storeName = settings?.storeName ?? 'm-POSw';
  const logoUrl = buildImageUrl(settings?.logoUrl);
  const [logoError, setLogoError] = useState(false);
  const initials = getInitials(storeName);
  const showLogo = Boolean(logoUrl) && !logoError;
  const location = useLocation();

  const moduleAccess = useModuleAccess;

  const prevWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : COLLAPSE_BREAKPOINT + 1
  );

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth <= COLLAPSE_BREAKPOINT;
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(navCategories.map((c) => c.label)));

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const prevWidth = prevWidthRef.current;
      prevWidthRef.current = currentWidth;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return;

      const crossingDown = prevWidth > COLLAPSE_BREAKPOINT && currentWidth <= COLLAPSE_BREAKPOINT;
      const crossingUp = prevWidth <= COLLAPSE_BREAKPOINT && currentWidth > COLLAPSE_BREAKPOINT;

      if (crossingDown) {
        setIsCollapsed(true);
      } else if (crossingUp) {
        setIsCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleCategory = useCallback((label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const isItemVisible = useCallback((item: NavItem) => {
    if (item.moduleKey) {
      const key = item.moduleKey;
      const settingVal = settings?.[key];
      if (settingVal === false) return false;
    }
    if (!isAdmin && item.permissionModule) {
      const access = moduleAccess(item.permissionModule as any);
      if (access === 'HIDDEN') return false;
    }
    return true;
  }, [settings, isAdmin, moduleAccess]);

  const filteredCategories = useMemo(() => {
    return navCategories
      .map((cat) => ({
        ...cat,
        children: cat.children.filter(isItemVisible),
      }))
      .filter((cat) => cat.children.length > 0);
  }, [isItemVisible]);

  const homeVisible = isItemVisible({
    to: '/admin/home',
    icon: <House size={iconSize} />,
    label: 'Home',
    permissionModule: 'CONFIGURACION',
  });

  const routeBelongsToCategory = useCallback((catLabel: string) => {
    const cat = navCategories.find((c) => c.label === catLabel);
    if (!cat) return false;
    return cat.children.some((item) => {
      if (item.to === location.pathname) return true;
      if (item.to !== '/pos' && item.to !== '/admin/home') {
        return location.pathname.startsWith(item.to);
      }
      if (item.to === '/pos' && location.pathname === '/pos') return true;
      return false;
    });
  }, [location.pathname]);

  return (
    <AppLayout title="">
      <div className="admin-layout">
        <nav className={`admin-sidebar${isCollapsed ? ' is-collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              {showLogo ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="sidebar-logo"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="sidebar-logo-placeholder" aria-hidden="true">
                  {initials}
                </div>
              )}
              {!isCollapsed && <span className="sidebar-brand-name">{storeName}</span>}
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {homeVisible && (
            <NavLink
              to="/admin/home"
              className={({ isActive }) => isActive ? 'active' : ''}
              title={isCollapsed ? 'Home' : undefined}
            >
              {navIcon(<House size={iconSize} />)}
              {!isCollapsed && 'Home'}
            </NavLink>
          )}

          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.label);
            const isActiveCategory = routeBelongsToCategory(cat.label);
            return (
              <div key={cat.label} className={`sidebar-category${isExpanded ? ' is-expanded' : ''}`}>
                <button
                  type="button"
                  className={`sidebar-category-header${isActiveCategory ? ' active-category' : ''}`}
                  onClick={() => toggleCategory(cat.label)}
                  title={isCollapsed ? cat.label : undefined}
                >
                  {navIcon(cat.icon)}
                  {!isCollapsed && (
                    <>
                      <span className="sidebar-category-label">{cat.label}</span>
                      <ChevronDown size={14} className={`sidebar-category-chevron${isExpanded ? ' rotated' : ''}`} />
                    </>
                  )}
                </button>
                {isExpanded && (
                  <div className="sidebar-category-children">
                    {cat.children.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/pos'}
                        className={({ isActive }) => isActive ? 'active' : ''}
                        title={isCollapsed ? item.label : undefined}
                      >
                        {navIcon(item.icon)}
                        {!isCollapsed && item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
};

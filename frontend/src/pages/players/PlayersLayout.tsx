import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Tag, Trophy, UserCog, Users } from 'lucide-react';
import { PageHeader, PageLayout } from '../../components/ui/PageLayout';
import { RouteTabs } from '../../components/ui/Tabs';

const TABS = [
  { value: 'dashboard', label: <><LayoutDashboard size={14} /> Dashboard</>, to: '/admin/players' },
  { value: 'jugadores', label: <><Users size={14} /> Jugadores</>, to: '/admin/players/jugadores' },
  { value: 'dts', label: <><UserCog size={14} /> DT's</>, to: '/admin/players/dts' },
  { value: 'categorias', label: <><Tag size={14} /> Categorías</>, to: '/admin/players/categorias' },
  { value: 'torneos', label: <><Trophy size={14} /> Torneos</>, to: '/admin/players/torneos' },
];

export const PlayersLayout: React.FC = () => (
  <PageLayout>
    <PageHeader title="Jugadores" description="Padrón, categorías y torneos." />
    <RouteTabs tabs={TABS} />
    <Outlet />
  </PageLayout>
);

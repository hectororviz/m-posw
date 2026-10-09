import { Outlet } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useLigasConfigs } from '../api/queries';
import { PageHeader, PageLayout } from '../components/ui/PageLayout';
import { RouteTabs } from '../components/ui/Tabs';

export const LigasLayout: React.FC = () => {
  const { data: configs, isLoading } = useLigasConfigs();
  const tabs = [
    ...(configs ?? []).map((cfg) => ({ value: cfg.id, label: cfg.nombre || cfg.leagueName, to: `/admin/ligas/${cfg.id}` })),
    { value: 'configuracion', label: <><Settings size={14} /> Config</>, to: '/admin/ligas/configuracion' },
  ];

  return (
    <PageLayout>
      <PageHeader title="Ligas" description="Tablas de posiciones y próximos partidos." />
      {isLoading ? <div className="spinner" /> : <RouteTabs tabs={tabs} />}
      <Outlet />
    </PageLayout>
  );
};

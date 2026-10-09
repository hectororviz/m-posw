import { Outlet } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/ui/PageLayout';
import { RouteTabs } from '../../components/ui/Tabs';
import { Boxes, Settings } from 'lucide-react';

const TABS = [
  { id: 'bienes', label: 'Bienes', icon: Boxes },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

export const PatrimonioPage: React.FC = () => {
  return (
    <PageLayout>
      <PageHeader title="Patrimonio" description="Bienes, categorías y estados." />
      <RouteTabs
        tabs={TABS.map((tab) => ({
          value: tab.id,
          label: <><tab.icon size={14} /> {tab.label}</>,
          to: tab.id === 'bienes' ? '/admin/patrimonio/bienes' : `/admin/patrimonio/${tab.id}`,
        }))}
      />
      <Outlet />
    </PageLayout>
  );
};

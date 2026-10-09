import { Outlet } from 'react-router-dom';
import { PageHeader, PageLayout } from '../components/ui/PageLayout';
import { RouteTabs } from '../components/ui/Tabs';

const TABS = [
  { value: 'socios', label: 'Socios', to: '/admin/socios' },
  { value: 'matriz', label: 'Matriz', to: '/admin/socios/matriz' },
  { value: 'configuracion', label: 'Configuración', to: '/admin/socios/configuracion' },
  { value: 'beneficios', label: 'Beneficios', to: '/admin/socios/beneficios' },
];

export const AdminSociosLayout: React.FC = () => {
  return (
    <PageLayout>
      <PageHeader title="Socios" description="Gestión del padrón de socios del club." />
      <RouteTabs tabs={TABS} />
      <Outlet />
    </PageLayout>
  );
};

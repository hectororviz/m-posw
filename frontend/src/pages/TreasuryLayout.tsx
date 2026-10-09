import { Outlet } from 'react-router-dom';
import { PageHeader, PageLayout } from '../components/ui/PageLayout';
import { RouteTabs } from '../components/ui/Tabs';

const TABS = [
  { value: 'resumen', label: 'Resumen', to: '/admin/tesoreria' },
  { value: 'efectivo', label: 'Efectivo', to: '/admin/tesoreria/efectivo' },
  { value: 'auditoria', label: 'Auditoría MP', to: '/admin/tesoreria/auditoria-mp' },
  { value: 'configuracion', label: 'Configuración', to: '/admin/tesoreria/configuracion' },
];

export const TreasuryLayout: React.FC = () => {
  return (
    <PageLayout>
      <PageHeader title="Tesorería" description="Caja, movimientos y auditoría de Mercado Pago." />
      <RouteTabs tabs={TABS} />
      <Outlet />
    </PageLayout>
  );
};

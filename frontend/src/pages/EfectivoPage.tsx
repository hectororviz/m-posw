import { FinanzasMovimientosPage } from './FinanzasMovimientosPage';
import { useMoneyAccounts } from '../api/queries';

export const EfectivoPage: React.FC = () => {
  const { data: accounts = [] } = useMoneyAccounts();
  const efectivo = accounts.find((a) => a.kind === 'EFECTIVO') ?? accounts.find((a) => /efectivo|caja/i.test(a.name));

  if (!efectivo) return <p className="loading-text">Cargando cuenta Efectivo...</p>;

  return (
    <FinanzasMovimientosPage
      fixedAccountId={efectivo.id}
      hideAccountFilter
    />
  );
};

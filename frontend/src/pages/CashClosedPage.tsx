import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

export const CashClosedPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AppLayout title="Caja cerrada">
      <div className="card cash-closed">
        <h3>La caja está cerrada</h3>
        <p>Necesitás una caja abierta para registrar o ver movimientos.</p>
        <button type="button" className="primary-button" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    </AppLayout>
  );
};

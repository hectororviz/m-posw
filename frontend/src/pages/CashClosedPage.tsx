import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';

export const CashClosedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canOpenCash = user?.role !== 'ADMIN';

  const handleOpenCash = async () => {
    setIsOpening(true);
    setError(null);
    try {
      await apiClient.post('/cash-sessions/open', { openingFloat: 0 });
      pushToast('Caja abierta.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <AppLayout title="Caja cerrada">
      <div className="card cash-closed">
        <h3>La caja está cerrada</h3>
        <p>Necesitás una caja abierta para registrar o ver movimientos.</p>
        {error && <p className="error-text">{error}</p>}
        {canOpenCash && (
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenCash}
            disabled={isOpening}
          >
            {isOpening ? 'Abriendo...' : 'Abrir caja'}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    </AppLayout>
  );
};

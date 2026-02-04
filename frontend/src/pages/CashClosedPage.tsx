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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const canOpenCash = user?.role !== 'ADMIN';

  const handleOpenCash = async () => {
    const normalizedValue = openingFloat.replace(',', '.');
    const openingAmount = Number(normalizedValue);
    if (Number.isNaN(openingAmount) || openingAmount < 0) {
      setError('Ingresá un monto válido para la apertura.');
      return;
    }
    setIsOpening(true);
    setError(null);
    try {
      await apiClient.post('/cash-sessions/open', { openingFloat: openingAmount });
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
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            disabled={isOpening}
          >
            {isOpening ? 'Abriendo...' : 'Abrir caja'}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>

      {isModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Abrir caja"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Abrir caja</h3>
              <button type="button" className="ghost-button" onClick={() => setIsModalOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              <p>Indicá el monto de cambio con el que se abre la caja.</p>
              <label className="input-field">
                Monto de apertura
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingFloat}
                  onChange={(event) => setOpeningFloat(event.target.value)}
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <div className="checkout-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isOpening}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleOpenCash}
                  disabled={isOpening}
                >
                  {isOpening ? 'Abriendo...' : 'Confirmar apertura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

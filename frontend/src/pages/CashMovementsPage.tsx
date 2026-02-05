import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CashMovement, CashMovementType, PaymentMethod } from '../api/types';
import { getCurrentCashMovements, voidCashMovement } from '../api/cashMovements';
import { normalizeApiError } from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { CashMovementCreateModal } from '../components/CashMovementCreateModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const typeLabels: Record<CashMovementType, string> = {
  IN: 'Ingreso',
  OUT: 'Egreso',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  MP_QR: 'QR',
};

interface VoidModalState {
  movement: CashMovement;
  reason: string;
}

export const CashMovementsPage: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | CashMovementType>('ALL');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [voidModal, setVoidModal] = useState<VoidModalState | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const handleCashClosed = useCallback(() => {
    if (user?.role === 'ADMIN') {
      pushToast('Caja cerrada', 'error');
    } else {
      navigate('/cash/closed');
    }
  }, [navigate, pushToast, user?.role]);

  const query = useQuery({
    queryKey: ['cash-movements', includeVoided],
    queryFn: () => getCurrentCashMovements(includeVoided),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        return false;
      }
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (query.error && axios.isAxiosError(query.error) && query.error.response?.status === 409) {
      handleCashClosed();
    }
  }, [query.error, handleCashClosed]);

  const movements = query.data ?? [];
  const filteredMovements = useMemo(() => {
    if (filter === 'ALL') {
      return movements;
    }
    return movements.filter((movement) => {
      if (movement.kind === 'SALE') {
        return filter === 'IN';
      }
      return movement.type === filter;
    });
  }, [filter, movements]);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
  };

  const handleVoidConfirm = async () => {
    if (!voidModal) {
      return;
    }
    if (!voidModal.reason.trim()) {
      pushToast('El motivo de anulación es obligatorio', 'error');
      return;
    }
    try {
      await voidCashMovement(voidModal.movement.id, voidModal.reason.trim());
      pushToast('Movimiento anulado.', 'success');
      setVoidModal(null);
      handleRefresh();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized === 'Caja cerrada') {
        handleCashClosed();
      } else {
        pushToast(normalized, 'error');
      }
    }
  };

  const renderList = () => {
    if (query.isLoading) {
      return <p>Cargando movimientos...</p>;
    }
    if (query.error) {
      return <p className="error-text">{normalizeApiError(query.error)}</p>;
    }
    if (filteredMovements.length === 0) {
      return <p>No hay movimientos registrados.</p>;
    }
    return (
      <div className="cash-movement-list">
        {filteredMovements.map((movement) => {
          const isAdmin = user?.role === 'ADMIN';
          if (movement.kind === 'SALE') {
            return (
              <div key={movement.id} className="cash-movement-card">
                <div className="cash-movement-card__header">
                  <span className="movement-type movement-type--in">Venta</span>
                  <span className="movement-time">{formatTime(movement.createdAt)}</span>
                </div>
                <div className="cash-movement-card__body">
                  <div>
                    <p className="movement-reason">
                      Venta registrada · {paymentMethodLabels[movement.paymentMethod]}
                    </p>
                    <p className="movement-meta">
                      Usuario: {movement.user?.name ?? 'Sin info'}
                    </p>
                  </div>
                  <div className="movement-amount">{formatCurrency(movement.total)}</div>
                </div>
              </div>
            );
          }
          return (
            <div
              key={movement.id}
              className={`cash-movement-card ${movement.isVoided ? 'is-voided' : ''}`}
            >
              <div className="cash-movement-card__header">
                <span className={`movement-type movement-type--${movement.type.toLowerCase()}`}>
                  {typeLabels[movement.type]}
                </span>
                <span className="movement-time">{formatTime(movement.createdAt)}</span>
                {movement.isVoided && <span className="movement-status">ANULADO</span>}
              </div>
              <div className="cash-movement-card__body">
                <div>
                  <p className="movement-reason">{movement.reason}</p>
                  {movement.note && <p className="movement-note">{movement.note}</p>}
                  <p className="movement-meta">
                    Usuario: {movement.createdBy?.name ?? 'Sin info'}
                  </p>
                </div>
                <div className="movement-amount">{formatCurrency(movement.amount)}</div>
              </div>
              {movement.isVoided && (
                <div className="movement-voided">
                  <strong>Motivo:</strong> {movement.voidReason ?? 'Sin detalle'}
                  {movement.voidedBy?.name ? ` · ${movement.voidedBy.name}` : ''}
                </div>
              )}
              <div className="cash-movement-card__actions">
                {isAdmin && !movement.isVoided && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setVoidModal({ movement, reason: '' })}
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout title="Movimientos de caja">
      <div className="cash-movements-page">
        <div className="cash-movements-header">
          <div className="cash-movements-filters">
            <button
              type="button"
              className={`chip-button ${filter === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`chip-button ${filter === 'IN' ? 'is-active' : ''}`}
              onClick={() => setFilter('IN')}
            >
              Ingresos
            </button>
            <button
              type="button"
              className={`chip-button ${filter === 'OUT' ? 'is-active' : ''}`}
              onClick={() => setFilter('OUT')}
            >
              Egresos
            </button>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(event) => setIncludeVoided(event.target.checked)}
            />
            Incluir anulados
          </label>
        </div>

        <div className="cash-movements-actions">
          <button type="button" className="primary-button" onClick={() => setIsCreateOpen(true)}>
            Nuevo movimiento
          </button>
          <button type="button" className="ghost-button" onClick={handleRefresh}>
            Refrescar
          </button>
        </div>

        {renderList()}
      </div>

      <CashMovementCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleRefresh}
        onCashClosed={handleCashClosed}
      />

      {voidModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Anular movimiento">
          <div className="modal">
            <div className="modal-header">
              <h3>Anular movimiento</h3>
              <button type="button" className="ghost-button" onClick={() => setVoidModal(null)}>
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              <p>
                Motivo obligatorio para anular <strong>{voidModal.movement.reason}</strong>.
              </p>
              <label className="input-field">
                Motivo
                <input
                  type="text"
                  value={voidModal.reason}
                  onChange={(event) =>
                    setVoidModal((prev) => (prev ? { ...prev, reason: event.target.value } : prev))
                  }
                />
              </label>
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={() => setVoidModal(null)}>
                  Cancelar
                </button>
                <button type="button" className="primary-button" onClick={handleVoidConfirm}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

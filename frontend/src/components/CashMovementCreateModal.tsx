import { useEffect, useMemo, useState } from 'react';
import type { CashMovementType } from '../api/types';
import { createCashMovement } from '../api/cashMovements';
import { normalizeApiError } from '../api/client';
import { useToast } from './ToastProvider';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const sanitizeCurrencyInput = (value: string) => {
  const normalized = value.replace(/[^\d.,]/g, '');
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const separatorIndex = Math.max(lastDot, lastComma);
  let integerPart = normalized;
  let decimalPart = '';
  if (separatorIndex >= 0) {
    integerPart = normalized.slice(0, separatorIndex);
    decimalPart = normalized.slice(separatorIndex + 1);
  }
  integerPart = integerPart.replace(/[^\d]/g, '');
  decimalPart = decimalPart.replace(/[^\d]/g, '').slice(0, 2);
  if (!integerPart && !decimalPart) {
    return '';
  }
  if (separatorIndex >= 0) {
    return `${integerPart || '0'}.${decimalPart}`;
  }
  return integerPart;
};

const reasonPresets = ['Compra', 'Cambio', 'Depósito', 'Retiro', 'Proveedor', 'Otro'];

interface CashMovementCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCashClosed: () => void;
}

export const CashMovementCreateModal: React.FC<CashMovementCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onCashClosed,
}) => {
  const { pushToast } = useToast();
  const [type, setType] = useState<CashMovementType>('IN');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [printVoucher, setPrintVoucher] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountValue = useMemo(() => Number(amountInput || 0), [amountInput]);
  const isValid = amountValue > 0 && reason.trim().length > 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setType('IN');
    setAmountInput('');
    setReason('');
    setSelectedPreset(null);
    setNote('');
    setPrintVoucher(false);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handlePresetClick = (preset: string) => {
    setSelectedPreset(preset);
    if (preset === 'Otro') {
      setReason('');
      return;
    }
    setReason(preset);
  };

  const handleAmountChange = (value: string) => {
    setAmountInput(sanitizeCurrencyInput(value));
  };

  const appendDigit = (digit: string) => {
    setAmountInput((prev) => sanitizeCurrencyInput(`${prev}${digit}`));
  };

  const appendDecimal = () => {
    setAmountInput((prev) => {
      if (prev.includes('.')) {
        return prev;
      }
      return prev ? `${prev}.` : '0.';
    });
  };

  const handleBackspace = () => {
    setAmountInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAmountInput('');
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await createCashMovement({
        type,
        amount: amountValue,
        reason: reason.trim(),
        note: note.trim() || undefined,
        printVoucher,
      });
      pushToast('Movimiento registrado.');
      setAmountInput('');
      setReason('');
      setSelectedPreset(null);
      setNote('');
      setPrintVoucher(false);
      onCreated();
      onClose();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized === 'Caja cerrada') {
        onCashClosed();
      } else {
        pushToast(normalized, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Nuevo movimiento">
      <div className="modal cash-movement-modal">
        <div className="modal-header">
          <h3>Nuevo movimiento</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          <div className="cash-movement-type">
            <button
              type="button"
              className={`primary-button ${type === 'IN' ? 'is-active' : ''}`}
              onClick={() => setType('IN')}
            >
              Ingreso
            </button>
            <button
              type="button"
              className={`secondary-button ${type === 'OUT' ? 'is-active' : ''}`}
              onClick={() => setType('OUT')}
            >
              Egreso
            </button>
          </div>

          <div className="cash-movement-amount">
            <label className="input-field">
              Monto
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(event) => handleAmountChange(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <div className="cash-movement-amount__preview">{formatCurrency(amountValue)}</div>
            <div className="pin-keypad cash-keypad" aria-label="Teclado numérico">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  type="button"
                  key={digit}
                  className="pin-key"
                  onClick={() => appendDigit(String(digit))}
                >
                  {digit}
                </button>
              ))}
              <button type="button" className="pin-key" onClick={appendDecimal}>
                .
              </button>
              <button type="button" className="pin-key" onClick={() => appendDigit('0')}>
                0
              </button>
              <button type="button" className="pin-key pin-key--secondary" onClick={handleBackspace}>
                ⌫
              </button>
              <button type="button" className="pin-key pin-key--secondary pin-key--wide" onClick={handleClear}>
                Borrar
              </button>
            </div>
          </div>

          <div className="cash-movement-reasons">
            <p>Motivo</p>
            <div className="cash-movement-reason__presets">
              {reasonPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`chip-button ${selectedPreset === preset ? 'is-active' : ''}`}
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <label className="input-field">
              Detalle
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Especificar motivo"
              />
            </label>
          </div>

          <label className="input-field">
            Nota (opcional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={printVoucher}
              onChange={(event) => setPrintVoucher(event.target.checked)}
            />
            Imprimir comprobante
          </label>

          <div className="checkout-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { apiClient, normalizeApiError } from '../api/client';
import { useAdminSales, useManualMovements, useSettings } from '../api/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { TicketPayload } from '../utils/ticketPrinting';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number | string) => {
  const normalizedValue = Number(value);
  const amount = Number.isFinite(normalizedValue) ? normalizedValue : 0;

  return `$ ${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  })}`;
};


const toAmount = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const getPaymentMethodLabel = (paymentMethod?: string) =>
  paymentMethod === 'MP_QR' ? 'QR MercadoPago' : 'Efectivo';

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

type SalesTableEntry =
  | {
      kind: 'SALE';
      id: string;
      createdAt: string;
      total: number;
      userName: string;
      paymentLabel: string;
      saleId: string;
    }
  | {
      kind: 'MOVEMENT';
      id: string;
      createdAt: string;
      total: number;
      userName: string;
      paymentLabel: string;
      reason: string;
    };

export const AdminSalesPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const { data: settings } = useSettings();
  const { data: movements = [] } = useManualMovements();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );

  const filteredEntries = useMemo(() => {
    if (!startDate && !endDate) {
      return [
        ...sales.map<SalesTableEntry>((sale) => ({
          kind: 'SALE',
          id: `sale-${sale.id}`,
          createdAt: sale.createdAt,
          total: sale.total,
          userName: sale.user?.name ?? 'Sin usuario',
          paymentLabel: getPaymentMethodLabel(sale.paymentMethod),
          saleId: sale.id,
        })),
        ...movements.map<SalesTableEntry>((movement) => ({
          kind: 'MOVEMENT',
          id: `movement-${movement.id}`,
          createdAt: movement.createdAt,
          total: movement.type === 'SALIDA' ? movement.amount * -1 : movement.amount,
          userName: 'Movimiento manual',
          paymentLabel: movement.type,
          reason: movement.reason,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    const entries: SalesTableEntry[] = [
      ...sales.map((sale) => ({
        kind: 'SALE' as const,
        id: `sale-${sale.id}`,
        createdAt: sale.createdAt,
        total: sale.total,
        userName: sale.user?.name ?? 'Sin usuario',
        paymentLabel: getPaymentMethodLabel(sale.paymentMethod),
        saleId: sale.id,
      })),
      ...movements.map((movement) => ({
        kind: 'MOVEMENT' as const,
        id: `movement-${movement.id}`,
        createdAt: movement.createdAt,
        total: movement.type === 'SALIDA' ? movement.amount * -1 : movement.amount,
        userName: 'Movimiento manual',
        paymentLabel: movement.type,
        reason: movement.reason,
      })),
    ];

    return entries
      .filter((entry) => {
        const createdAt = new Date(entry.createdAt);
        if (start && createdAt < start) {
          return false;
        }
        if (end && createdAt > end) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, movements, startDate, endDate]);

  const filteredMovements = useMemo(() => {
    if (!printStart && !printEnd) {
      return movements;
    }
    const start = printStart ? new Date(printStart) : null;
    const end = printEnd ? new Date(printEnd) : null;

    return movements.filter((movement) => {
      const createdAt = new Date(movement.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });
  }, [movements, printStart, printEnd]);

  const handleDownload = () => {
    if (filteredEntries.length === 0) {
      return;
    }
    const headers = ['Fecha', 'Hora', 'Usuario', 'Total', 'Forma de pago', 'Productos'];
    const data = filteredEntries.map((entry) => {
      if (entry.kind === 'MOVEMENT') {
        return [
          formatDate(entry.createdAt),
          formatTime(entry.createdAt),
          entry.userName,
          formatCurrency(entry.total),
          entry.paymentLabel,
          entry.reason,
        ];
      }

      const sale = sales.find((item) => item.id === entry.saleId);
      return [
        formatDate(entry.createdAt),
        formatTime(entry.createdAt),
        entry.userName,
        formatCurrency(entry.total),
        entry.paymentLabel,
        sale?.items.map((item) => `${item.quantity} x ${item.product.name}`).join(' | ') ?? '',
      ];
    });
    const csvContent =
      '\uFEFF' +
      [headers, ...data]
        .map((line) => line.map((value) => `"${value.replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventas-${startDate || 'inicio'}-${endDate || 'fin'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPrint = () => {
    setPrintStart(startDate ? `${startDate}T00:00` : '');
    setPrintEnd(endDate ? `${endDate}T23:59` : '');
    setIsPrintOpen(true);
  };

  const handleClosePrint = () => {
    setIsPrintOpen(false);
  };

  const handleOpenMovement = () => {
    setMovementType('ENTRADA');
    setMovementAmount('');
    setMovementReason('');
    setIsMovementOpen(true);
  };

  const handleCloseMovement = () => {
    setIsMovementOpen(false);
  };

  const handleSaveMovement = async () => {
    const amount = Number(movementAmount);
    const reason = movementReason.trim();
    if (!Number.isFinite(amount) || amount <= 0 || reason.length === 0) {
      return;
    }

    setIsSavingMovement(true);
    try {
      await apiClient.post('/sales/manual-movements', {
        type: movementType,
        amount,
        reason,
      });
      await queryClient.invalidateQueries({ queryKey: ['manual-movements'] });
      pushToast('Movimiento agregado correctamente.', 'success');
      setIsMovementOpen(false);
    } catch (error) {
      pushToast(normalizeApiError(error), 'error');
    } finally {
      setIsSavingMovement(false);
    }
  };

  const isMovementValid = Number(movementAmount) > 0 && movementReason.trim().length > 0;

  const handlePrint = () => {
    const start = printStart ? new Date(printStart) : null;
    const end = printEnd ? new Date(printEnd) : null;
    const salesForPrint = sales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });

    if (salesForPrint.length === 0 && filteredMovements.length === 0) {
      pushToast('No hay movimientos ni ventas para imprimir con ese rango.', 'error');
      return;
    }

    const itemsForPrint = salesForPrint.flatMap((sale) => sale.items).reduce((acc, item) => {
      const existing = acc.get(item.product.name) ?? 0;
      acc.set(item.product.name, existing + item.quantity);
      return acc;
    }, new Map<string, number>());
    const items = Array.from(itemsForPrint.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => (b.qty !== a.qty ? b.qty - a.qty : a.name.localeCompare(b.name)));
    const totalProducts = salesForPrint.reduce(
      (acc, sale) => acc + sale.items.reduce((saleAcc, item) => saleAcc + item.quantity, 0),
      0,
    );
    const totalCash = salesForPrint
      .filter((sale) => sale.paymentMethod !== 'MP_QR')
      .reduce((acc, sale) => acc + toAmount(sale.total), 0);
    const totalQr = salesForPrint
      .filter((sale) => sale.paymentMethod === 'MP_QR')
      .reduce((acc, sale) => acc + toAmount(sale.total), 0);
    const total = toAmount(totalCash) + toAmount(totalQr);
    const totalMovementIn = filteredMovements
      .filter((movement) => movement.type === 'ENTRADA')
      .reduce((acc, movement) => acc + toAmount(movement.amount), 0);
    const totalMovementOut = filteredMovements
      .filter((movement) => movement.type === 'SALIDA')
      .reduce((acc, movement) => acc + toAmount(movement.amount), 0);
    const totalCashInDrawer = totalCash + totalMovementIn - totalMovementOut;

    const payload: TicketPayload = {
      clubName: settings?.clubName ?? '',
      storeName: settings?.storeName ?? 'SOLER - Bufet',
      dateTimeISO: new Date().toISOString(),
      itemsStyle: 'summary',
      items,
      total,
      criteria: [],
      summary: [
        { label: 'Ventas:', value: formatCurrency(total) },
        { label: 'Entradas:', value: formatCurrency(totalMovementIn) },
        { label: 'Salidas:', value: formatCurrency(totalMovementOut) },
        { label: '', value: '' },
        { label: 'Efectivo:', value: formatCurrency(totalCashInDrawer) },
        { label: 'QR:', value: formatCurrency(totalQr) },
        { label: 'Productos vendidos:', value: totalProducts.toString() },
      ],
    };

    const ticketParam = encodeBase64Url(JSON.stringify(payload));
    const url = `/print/ticket?ticket=${ticketParam}&autoPrint=1&autoClose=1`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      pushToast('No se pudo abrir la ventana de impresión. Revisá el bloqueador de popups.', 'error');
      return;
    }

    setIsPrintOpen(false);
  };

  const handleReprintTicket = async (saleId: string) => {
    const sale = sales.find((entry) => entry.id === saleId);
    if (!sale) {
      return;
    }

    try {
      await apiClient.post(`/sales/${saleId}/ticket-printed`);
    } catch (error) {
      pushToast(normalizeApiError(error), 'error');
    }

    const payload: TicketPayload = {
      clubName: settings?.clubName ?? '',
      storeName: settings?.storeName ?? 'SOLER - Bufet',
      dateTimeISO: sale.createdAt,
      itemsStyle: 'sale',
      items: sale.items.map((item) => ({
        qty: item.quantity,
        name: item.product.name,
      })),
      total: sale.total,
      thanks: 'Gracias por tu compra',
      footer: 'Ticket no fiscal',
    };

    const ticketParam = encodeBase64Url(JSON.stringify(payload));
    const url = `/print/ticket?ticket=${ticketParam}&autoPrint=1&autoClose=1`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      pushToast('No se pudo abrir la ventana de impresión. Revisá el bloqueador de popups.', 'error');
      return;
    }

    pushToast('Enviando ticket a impresión.', 'success');
  };

  return (
    <section className="card admin-sales">
      <h2>Ventas</h2>
      <p>Revisa el detalle de ventas y exporta el resultado filtrado.</p>
      <div className="form-grid">
        <label className="input-field">
          Desde
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="input-field">
          Hasta
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <div className="row-actions">
          <button type="button" className="secondary-button" onClick={handleOpenMovement}>
            Agregar movimiento
          </button>
          <button className="primary-button" onClick={handleDownload} disabled={filteredEntries.length === 0}>
            Descargar Excel
          </button>
          <button className="secondary-button" onClick={handleOpenPrint}>
            Imprimir
          </button>
        </div>
      </div>
      <div className="table">
        <div className="table-row table-header">
          <strong>Fecha</strong>
          <strong>Hora</strong>
          <strong>Usuario</strong>
          <strong>Total</strong>
          <strong>Forma de pago</strong>
          <strong>Acción</strong>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="table-row">
            <span>No hay ventas para el rango seleccionado.</span>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div className="table-row" key={entry.id}>
              <span>{formatDate(entry.createdAt)}</span>
              <span>{formatTime(entry.createdAt)}</span>
              <span>{entry.userName}</span>
              <span>{formatCurrency(entry.total)}</span>
              <span>{entry.paymentLabel}</span>
              {entry.kind === 'SALE' ? (
                <button type="button" className="secondary-button" onClick={() => setSelectedSaleId(entry.saleId)}>
                  Ver detalle
                </button>
              ) : (
                <span>{entry.reason}</span>
              )}
            </div>
          ))
        )}
      </div>
      {selectedSale && (
        <div className="modal-backdrop" onClick={() => setSelectedSaleId(null)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle de venta</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedSaleId(null)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="modal-body admin-sales__detail">
              <p>
                <strong>Fecha:</strong> {formatDate(selectedSale.createdAt)} {formatTime(selectedSale.createdAt)}
              </p>
              <p>
                <strong>Total:</strong> {formatCurrency(selectedSale.total)}
              </p>
              <p>
                <strong>Medio de pago:</strong> {getPaymentMethodLabel(selectedSale.paymentMethod)}
              </p>
              <div>
                <strong>Productos</strong>
                <ul>
                  {selectedSale.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} x {item.product.name} ({formatCurrency(item.subtotal)})
                    </li>
                  ))}
                </ul>
              </div>
              <div className="checkout-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleReprintTicket(selectedSale.id)}
                >
                  🎟️ Reimprimir ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isPrintOpen && (
        <div className="modal-backdrop" onClick={handleClosePrint} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Imprimir detalle</h2>
              <button type="button" className="icon-button" onClick={handleClosePrint} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label className="input-field">
                Desde
                <input
                  type="datetime-local"
                  value={printStart}
                  onChange={(event) => setPrintStart(event.target.value)}
                />
              </label>
              <label className="input-field">
                Hasta
                <input
                  type="datetime-local"
                  value={printEnd}
                  onChange={(event) => setPrintEnd(event.target.value)}
                />
              </label>
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={handleClosePrint}>
                  Cancelar
                </button>
                <button type="button" className="primary-button" onClick={handlePrint}>
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isMovementOpen && (
        <div className="modal-backdrop" onClick={handleCloseMovement} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar movimiento</h2>
              <button type="button" className="icon-button" onClick={handleCloseMovement} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body admin-sales__movement-form">
              <fieldset className="admin-sales__movement-type" aria-label="Tipo de movimiento">
                <label>
                  <input
                    type="radio"
                    name="movement-type"
                    value="ENTRADA"
                    checked={movementType === 'ENTRADA'}
                    onChange={() => setMovementType('ENTRADA')}
                  />
                  Entrada
                </label>
                <label>
                  <input
                    type="radio"
                    name="movement-type"
                    value="SALIDA"
                    checked={movementType === 'SALIDA'}
                    onChange={() => setMovementType('SALIDA')}
                  />
                  Salida
                </label>
              </fieldset>
              <label className="input-field">
                Monto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                />
              </label>
              <label className="input-field">
                Motivo
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Describí el motivo"
                  value={movementReason}
                  onChange={(event) => setMovementReason(event.target.value)}
                />
              </label>
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={handleCloseMovement}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSaveMovement}
                  disabled={!isMovementValid || isSavingMovement}
                >
                  {isSavingMovement ? 'Guardando...' : 'Guardar movimiento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

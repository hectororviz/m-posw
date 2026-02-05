import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminSales, useSettings } from '../api/queries';
import { apiClient } from '../api/client';
import type { TicketPayload } from '../utils/ticketPrinting';
import { useToast } from '../components/ToastProvider';

type CashSummary = {
  salesCashTotal: number;
  salesQrTotal: number;
  salesTotal: number;
  salesCount: number;
  movementsOutTotal: number;
  movementsInTotal: number;
  movementsNet: number;
  netCashDelta: number;
  movementsCount: number;
};

type CurrentPeriodResponse = {
  from: string;
  to: string;
  summary: CashSummary;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

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
  });

const formatDateTime = (value: string) => {
  const date = new Date(value);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const AdminSalesPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'OUT' | 'IN'>('OUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [periodPreview, setPeriodPreview] = useState<CurrentPeriodResponse | null>(null);

  const rows = useMemo(() => {
    return sales.flatMap((sale) =>
      sale.items.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        createdAt: sale.createdAt,
        quantity: item.quantity,
        productName: item.product.name,
        total: item.product.price * item.quantity,
        paymentMethod: sale.paymentMethod ?? 'CASH',
        userName: sale.user?.name ?? 'Sin usuario',
      })),
    );
  }, [sales]);

  const filteredRows = useMemo(() => {
    if (!startDate && !endDate) {
      return rows;
    }
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return rows.filter((row) => {
      const createdAt = new Date(row.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });
  }, [rows, startDate, endDate]);

  const handleDownload = () => {
    if (filteredRows.length === 0) {
      return;
    }
    const headers = ['Fecha', 'Hora', 'Cantidad', 'Producto', 'Usuario', 'Total', 'Forma de pago'];
    const data = filteredRows.map((row) => [
      formatDate(row.createdAt),
      formatTime(row.createdAt),
      row.quantity.toString(),
      row.productName,
      row.userName,
      formatCurrency(row.total),
      row.paymentMethod === 'MP_QR' ? 'QR MercadoPago' : 'Efectivo',
    ]);
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

  const handlePrint = () => {
    const start = printStart ? new Date(printStart) : null;
    const end = printEnd ? new Date(printEnd) : null;
    const rowsForPrint = rows.filter((row) => {
      const createdAt = new Date(row.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });

    if (rowsForPrint.length === 0) {
      pushToast('No hay ventas para imprimir con ese rango.', 'error');
      return;
    }

    const itemsForPrint = rowsForPrint.reduce((acc, row) => {
      const existing = acc.get(row.productName) ?? 0;
      acc.set(row.productName, existing + row.quantity);
      return acc;
    }, new Map<string, number>());
    const items = Array.from(itemsForPrint.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => (b.qty !== a.qty ? b.qty - a.qty : a.name.localeCompare(b.name)));
    const totalProducts = rowsForPrint.reduce((acc, row) => acc + row.quantity, 0);
    const totalCash = rowsForPrint
      .filter((row) => row.paymentMethod !== 'MP_QR')
      .reduce((acc, row) => acc + row.total, 0);
    const totalQr = rowsForPrint
      .filter((row) => row.paymentMethod === 'MP_QR')
      .reduce((acc, row) => acc + row.total, 0);
    const total = totalCash + totalQr;

    const payload: TicketPayload = {
      clubName: settings?.clubName ?? '',
      storeName: settings?.storeName ?? 'SOLER - Bufet',
      dateTimeISO: new Date().toISOString(),
      itemsStyle: 'summary',
      items,
      total,
      criteria: [
        { label: 'Desde', value: printStart ? formatDateTime(printStart) : 'Sin filtro' },
        { label: 'Hasta', value: printEnd ? formatDateTime(printEnd) : 'Sin filtro' },
      ],
      summary: [
        { label: 'Productos vendidos', value: totalProducts.toString() },
        { label: 'Total efectivo', value: formatCurrency(totalCash) },
        { label: 'Total QR', value: formatCurrency(totalQr) },
        { label: 'Total', value: formatCurrency(total) },
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

  const handleCreateMovement = async () => {
    const amount = Number(movementAmount);
    if (!amount || amount <= 0) {
      pushToast('Ingresá un monto válido.', 'error');
      return;
    }
    await apiClient.post('/cash-movements', {
      type: movementType,
      amount,
      reason: movementReason || undefined,
    });
    setIsMovementOpen(false);
    setMovementAmount('');
    setMovementReason('');
    pushToast('Movimiento registrado.', 'success');
  };

  const handleOpenClosePeriod = async () => {
    const response = await apiClient.get<CurrentPeriodResponse>('/cash-close/current-period');
    setPeriodPreview(response.data);
    setIsCloseOpen(true);
  };

  const handleClosePeriod = async () => {
    const response = await apiClient.post('/cash-close/close', {});
    setIsCloseOpen(false);
    setPeriodPreview(null);
    await queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
    pushToast(`Cierre guardado (${response.data.cashClose?.id ?? ''}).`, 'success');
  };

  return (
    <section className="card admin-sales">
      <h2>Ventas</h2>
      <p>Revisa el detalle de ventas y exporta el resultado filtrado.</p>
      <div className="form-grid admin-sales__filters">
        <label className="input-field admin-sales__date-field">
          Desde
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="input-field admin-sales__date-field">
          Hasta
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <div className="admin-sales__actions-grid">
          <button className="primary-button" onClick={() => setIsMovementOpen(true)}>
            Agregar movimiento
          </button>
          <button className="secondary-button" onClick={handleDownload} disabled={filteredRows.length === 0}>
            Descargar Excel
          </button>
          <button className="primary-button" onClick={handleOpenClosePeriod}>
            Cierre parcial
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
          <strong>Cantidad</strong>
          <strong>Producto</strong>
          <strong>Usuario</strong>
          <strong>Total</strong>
          <strong>Forma de pago</strong>
        </div>
        {filteredRows.length === 0 ? (
          <div className="table-row">
            <span>No hay ventas para el rango seleccionado.</span>
          </div>
        ) : (
          filteredRows.map((row) => (
            <div className="table-row" key={`${row.saleId}-${row.productId}`}>
              <span>{formatDate(row.createdAt)}</span>
              <span>{formatTime(row.createdAt)}</span>
              <span>{row.quantity}</span>
              <span>{row.productName}</span>
              <span>{row.userName}</span>
              <span>{formatCurrency(row.total)}</span>
              <span>{row.paymentMethod === 'MP_QR' ? 'QR MercadoPago' : 'Efectivo'}</span>
            </div>
          ))
        )}
      </div>

      {isMovementOpen && (
        <div className="modal-backdrop" onClick={() => setIsMovementOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar movimiento</h2>
              <button type="button" className="icon-button" onClick={() => setIsMovementOpen(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label className="input-field">
                Tipo
                <select value={movementType} onChange={(e) => setMovementType(e.target.value as 'OUT' | 'IN')}>
                  <option value="OUT">Sacar efectivo</option>
                  <option value="IN">Ingresar efectivo</option>
                </select>
              </label>
              <label className="input-field">
                Monto
                <input type="number" min={0.01} step={0.01} value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
              </label>
              <label className="input-field">
                Motivo
                <input type="text" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} />
              </label>
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={() => setIsMovementOpen(false)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={handleCreateMovement}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCloseOpen && periodPreview && (
        <div className="modal-backdrop" onClick={() => setIsCloseOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirmar cierre parcial</h2>
              <button type="button" className="icon-button" onClick={() => setIsCloseOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">
              <p>Desde: {formatDateTime(periodPreview.from)}</p>
              <p>Hasta: {formatDateTime(periodPreview.to)}</p>
              <p>Ventas efectivo: {formatCurrency(periodPreview.summary.salesCashTotal)}</p>
              <p>Ventas QR: {formatCurrency(periodPreview.summary.salesQrTotal)}</p>
              <p>Total ventas: {formatCurrency(periodPreview.summary.salesTotal)}</p>
              <p>Ingresos mov.: {formatCurrency(periodPreview.summary.movementsInTotal)}</p>
              <p>Salidas mov.: {formatCurrency(periodPreview.summary.movementsOutTotal)}</p>
              <p>Neto mov.: {formatCurrency(periodPreview.summary.movementsNet)}</p>
              <p>Variación caja: {formatCurrency(periodPreview.summary.netCashDelta)}</p>
              <div className="checkout-actions">
                <button type="button" className="secondary-button" onClick={() => setIsCloseOpen(false)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={handleClosePeriod}>Cerrar período (Z)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPrintOpen && (
        <div className="modal-backdrop" onClick={() => setIsPrintOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Imprimir detalle</h2>
              <button type="button" className="icon-button" onClick={() => setIsPrintOpen(false)} aria-label="Cerrar">
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
                <button type="button" className="secondary-button" onClick={() => setIsPrintOpen(false)}>
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
    </section>
  );
};

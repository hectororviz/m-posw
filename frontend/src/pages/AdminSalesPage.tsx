import { useMemo, useState } from 'react';
import { useAdminSales, useSettings } from '../api/queries';
import type { TicketPayload } from '../utils/ticketPrinting';
import { useToast } from '../components/ToastProvider';

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
  const { pushToast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');

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

  const handleClosePrint = () => {
    setIsPrintOpen(false);
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
          <button className="primary-button" onClick={handleDownload} disabled={filteredRows.length === 0}>
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
    </section>
  );
};

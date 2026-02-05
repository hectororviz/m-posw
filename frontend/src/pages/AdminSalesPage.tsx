import { useMemo, useState } from 'react';
import { apiClient, normalizeApiError } from '../api/client';
import { useAdminSales, useSettings } from '../api/queries';
import type { TicketPayload } from '../utils/ticketPrinting';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  });

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
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [printStart, setPrintStart] = useState('');
  const [printEnd, setPrintEnd] = useState('');

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );

  const filteredSales = useMemo(() => {
    if (!startDate && !endDate) {
      return sales;
    }
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return sales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }
      return true;
    });
  }, [sales, startDate, endDate]);

  const handleDownload = () => {
    if (filteredSales.length === 0) {
      return;
    }
    const headers = ['Fecha', 'Hora', 'Usuario', 'Total', 'Forma de pago', 'Productos'];
    const data = filteredSales.map((sale) => [
      formatDate(sale.createdAt),
      formatTime(sale.createdAt),
      sale.user?.name ?? 'Sin usuario',
      formatCurrency(sale.total),
      getPaymentMethodLabel(sale.paymentMethod),
      sale.items
        .map((item) => `${item.quantity} x ${item.product.name}`)
        .join(' | '),
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

    if (salesForPrint.length === 0) {
      pushToast('No hay ventas para imprimir con ese rango.', 'error');
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
      .reduce((acc, sale) => acc + sale.total, 0);
    const totalQr = salesForPrint
      .filter((sale) => sale.paymentMethod === 'MP_QR')
      .reduce((acc, sale) => acc + sale.total, 0);
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
          <button className="primary-button" onClick={handleDownload} disabled={filteredSales.length === 0}>
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
        {filteredSales.length === 0 ? (
          <div className="table-row">
            <span>No hay ventas para el rango seleccionado.</span>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <div className="table-row" key={sale.id}>
              <span>{formatDate(sale.createdAt)}</span>
              <span>{formatTime(sale.createdAt)}</span>
              <span>{sale.user?.name ?? 'Sin usuario'}</span>
              <span>{formatCurrency(sale.total)}</span>
              <span>{getPaymentMethodLabel(sale.paymentMethod)}</span>
              <button type="button" className="secondary-button" onClick={() => setSelectedSaleId(sale.id)}>
                Ver detalle
              </button>
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
    </section>
  );
};

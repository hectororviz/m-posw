import { useMemo, useState } from 'react';
import { useAdminSales } from '../api/queries';

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

export const AdminSalesPage: React.FC = () => {
  const { data: sales = [] } = useAdminSales();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    </section>
  );
};

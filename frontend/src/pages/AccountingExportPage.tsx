import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiClient, normalizeApiError } from '../api/client';
import { useAccountingSummary } from '../api/queries';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export const AccountingExportPage: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const { data: summary } = useAccountingSummary(
    from || to ? { from: from || undefined, to: to || undefined } : undefined,
  );

  const handleDownload = async () => {
    setError('');
    setDownloading(true);
    try {
      const response = await apiClient.get('/accounting/export', {
        params: { from: from || undefined, to: to || undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contabilidad.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(normalizeApiError(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="card">
      <h2>Exportar a Excel</h2>

      <nav className="accounting-nav">
        <NavLink to="/admin/contabilidad" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/admin/contabilidad/movimientos" className={({ isActive }) => (isActive ? 'active' : '')}>
          Movimientos
        </NavLink>
        <NavLink to="/admin/contabilidad/jornadas" className={({ isActive }) => (isActive ? 'active' : '')}>
          Jornadas
        </NavLink>
        <NavLink to="/admin/contabilidad/categorias" className={({ isActive }) => (isActive ? 'active' : '')}>
          Categorías
        </NavLink>
        <NavLink to="/admin/contabilidad/exportar" className={({ isActive }) => (isActive ? 'active' : '')}>
          Exportar
        </NavLink>
      </nav>
      <p>Seleccioná el rango de fechas y descargá el archivo con todos los movimientos.</p>

      <div className="form-grid accounting-export-filters">
        <label className="input-field">
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="input-field">
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          className="primary-button"
          onClick={handleDownload}
          disabled={downloading}
          style={{ alignSelf: 'flex-end' }}
        >
          {downloading ? 'Descargando...' : 'Descargar Excel'}
        </button>
      </div>

      {error && <div className="error-text" style={{ marginTop: '1rem' }}>{error}</div>}

      {summary && (
        <div className="accounting-summary-cards" style={{ marginTop: '1.5rem' }}>
          <div className="accounting-summary-card income">
            <span className="accounting-summary-card__label">Total ingresos del período</span>
            <span className="accounting-summary-card__value">{formatCurrency(summary.totalIncome)}</span>
          </div>
          <div className="accounting-summary-card expense">
            <span className="accounting-summary-card__label">Total egresos del período</span>
            <span className="accounting-summary-card__value">{formatCurrency(summary.totalExpense)}</span>
          </div>
          <div className="accounting-summary-card net">
            <span className="accounting-summary-card__label">Saldo neto</span>
            <span className="accounting-summary-card__value">{formatCurrency(summary.netBalance)}</span>
          </div>
          <div className="accounting-summary-card sales">
            <span className="accounting-summary-card__label">Ventas de jornada</span>
            <span className="accounting-summary-card__value">{formatCurrency(summary.jornadaSalesTotal)}</span>
          </div>
        </div>
      )}
    </section>
  );
};

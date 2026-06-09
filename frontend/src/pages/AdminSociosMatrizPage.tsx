import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSociosMatriz } from '../api/queries';
import type { SocioMatrizFilas } from '../api/types';

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const EstadoEmoji: React.FC<{ estado: string; pendiente?: number }> = ({ estado, pendiente }) => {
  if (estado === 'PAGADO') return <span title="Pagado" style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '1.1rem' }}>&#10003;</span>;
  if (estado === 'PARCIAL') return <span title={`Parcial - pendiente: ${formatCurrency(pendiente ?? 0)}`} style={{ color: 'var(--color-warning, #f59e0b)', fontWeight: 600, fontSize: '1.1rem' }}>&#9633;</span>;
  if (estado === 'PENDIENTE' || estado === 'PENDIENTE_SIN_CUOTA') return <span title={`Pendiente - ${formatCurrency(pendiente ?? 0)}`} style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '1.1rem' }}>&#10007;</span>;
  return <span title="No aplica" style={{ color: 'var(--color-text-faint)' }}>&mdash;</span>;
};

export const AdminSociosMatrizPage: React.FC = () => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const [anio, setAnio] = useState(currentYear);
  const { data: matriz, isLoading } = useSociosMatriz(anio);
  const navigate = useNavigate();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 5; y <= currentYear; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/admin/socios')}
              style={{ marginBottom: '0.5rem' }}
            >
              &larr; Volver
            </button>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Matriz de Cuotas</h2>
            <p className="page-header-subtitle">Estado de cuotas por socio y mes.</p>
          </div>
        </div>
      </div>

      <div className="stock-toolbar">
        <select
          className="stock-search-input"
          style={{ flex: '0 0 auto', maxWidth: '140px' }}
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="settings-section" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-success)' }}>&#10003; Pagado</span>
        <span style={{ color: 'var(--color-warning, #f59e0b)' }}>&#9633; Parcial</span>
        <span style={{ color: 'var(--color-danger)' }}>&#10007; Pendiente</span>
        <span style={{ color: 'var(--color-text-faint)' }}>&mdash; No aplica</span>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
        </div>
      ) : !matriz || matriz.filas.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0 }}>No hay datos para mostrar.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: '1100px' }}>
            <div className="sales-table">
              <div className="sales-table-head">
                <span className="col-user" style={{ flex: '0 0 60px' }}>Nro</span>
                <span className="col-user" style={{ flex: '0 0 180px' }}>Socio</span>
                {MONTH_NAMES.map((m) => (
                  <span
                    key={m}
                    className="col-total"
                    style={{ flex: '0 0 55px', textAlign: 'center', fontWeight: 600 }}
                  >
                    {m}
                  </span>
                ))}
                <span className="col-total" style={{ flex: '0 0 90px', textAlign: 'right' }}>Deuda</span>
              </div>
              {matriz.filas.map((f: SocioMatrizFilas) => (
                <div key={f.socioId} className="sales-table-row">
                  <span className="col-user" style={{ flex: '0 0 60px', fontWeight: 500 }}>
                    {f.nroSocio}
                  </span>
                  <span className="col-user" style={{ flex: '0 0 180px', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.apellido}, {f.nombre}
                  </span>
                  {MONTH_NAMES.map((_m, i) => {
                    const mes = i + 1;
                    const cell = f.meses[mes];
                    return (
                      <span
                        key={mes}
                        className="col-total"
                        style={{ flex: '0 0 55px', textAlign: 'center' }}
                      >
                        {cell ? (
                          <EstadoEmoji estado={cell.estado} pendiente={cell.pendiente} />
                        ) : (
                          <span style={{ color: 'var(--color-text-faint)' }}>&mdash;</span>
                        )}
                      </span>
                    );
                  })}
                  <span className="col-total" style={{ flex: '0 0 90px', textAlign: 'right', fontWeight: 600, color: f.deudaAnual > 0 ? 'var(--color-danger)' : undefined }}>
                    {f.deudaAnual > 0 ? formatCurrency(f.deudaAnual) : <span style={{ color: 'var(--color-text-muted)' }}>$0</span>}
                  </span>
                </div>
              ))}
              <div className="sales-table-row" style={{ background: 'var(--color-surface)', fontWeight: 600, borderTop: '2px solid var(--color-border)' }}>
                <span className="col-user" style={{ flex: '0 0 240px' }}>TOTAL POR MES</span>
                {MONTH_NAMES.map((_, i) => {
                  const mes = i + 1;
                  const total = matriz.totalesPorMes[mes] || 0;
                  return (
                    <span
                      key={mes}
                      className="col-total"
                      style={{ flex: '0 0 55px', textAlign: 'center', fontSize: '0.8rem', color: total > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                    >
                      {total > 0 ? formatCurrency(total) : '$0'}
                    </span>
                  );
                })}
                <span className="col-total" style={{ flex: '0 0 90px' }}></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

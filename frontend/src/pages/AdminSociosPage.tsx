import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSocios, useSociosTipos, useSociosTesoreriaResumen } from '../api/queries';
import type { Socio } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const estadoBadge = (estado: string) => {
  if (estado === 'ACTIVO') return <span className="badge badge-success">Activo</span>;
  if (estado === 'SUSPENDIDO') return <span className="badge badge-warning">Suspendido</span>;
  return <span className="badge badge-neutral">Inactivo</span>;
};

export const AdminSociosPage: React.FC = () => {
  const [filters, setFilters] = useState<{ estado?: string; socioTipoId?: string; deuda?: string }>({});
  const { data: socios = [], isLoading } = useSocios(filters);
  const { data: resumen } = useSociosTesoreriaResumen();
  const { data: tipos = [] } = useSociosTipos();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return socios;
    const q = search.toLowerCase();
    return socios.filter(
      (s) =>
        s.apellido.toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        String(s.nroSocio).includes(q) ||
        s.dni.includes(q),
    );
  }, [socios, search]);

  const handleDeactivate = async (id: number) => {
    try {
      await apiClient.delete(`/socios/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
      await queryClient.invalidateQueries({ queryKey: ['socios-tesoreria-resumen'] });
      pushToast('Socio dado de baja', 'success');
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Socios</h2>
            <p className="page-header-subtitle">Gestion del padron de socios del club.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => navigate('/admin/socios/tipos')}>
              Tipos
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate('/admin/socios/matriz')}>
              Matriz
            </button>
          </div>
        </div>
      </div>

      {resumen && (
        <div className="sales-kpis">
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Deuda total</span>
            <span className="sales-kpi-value">{formatCurrency(resumen.deudaTotal)}</span>
          </div>
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Socios activos</span>
            <span className="sales-kpi-value">{resumen.sociosActivos}</span>
          </div>
          <div className="sales-kpi-card">
            <span className="sales-kpi-label">Con deuda</span>
            <span className="sales-kpi-value">{resumen.sociosConDeuda}</span>
          </div>
        </div>
      )}

      <div className="stock-toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input
          type="text"
          className="stock-search-input"
          placeholder="Buscar por nombre, Nº socio o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="stock-search-input"
          style={{ flex: '0 0 auto', maxWidth: '160px' }}
          value={filters.estado || ''}
          onChange={(e) => setFilters({ ...filters, estado: e.target.value || undefined })}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
          <option value="SUSPENDIDO">Suspendidos</option>
        </select>
        <select
          className="stock-search-input"
          style={{ flex: '0 0 auto', maxWidth: '180px' }}
          value={filters.socioTipoId || ''}
          onChange={(e) => setFilters({ ...filters, socioTipoId: e.target.value || undefined })}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        <select
          className="stock-search-input"
          style={{ flex: '0 0 auto', maxWidth: '140px' }}
          value={filters.deuda || ''}
          onChange={(e) => setFilters({ ...filters, deuda: e.target.value || undefined })}
        >
          <option value="">Deuda: todos</option>
          <option value="con-deuda">Con deuda</option>
          <option value="al-dia">Al dia</option>
        </select>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>
            {search || filters.estado || filters.deuda ? 'Sin resultados para los filtros aplicados.' : 'No hay socios registrados.'}
          </p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date" style={{ flex: '0 0 70px' }}>Nº</span>
              <span className="col-user" style={{ flex: 1 }}>Apellido y Nombre</span>
              <span className="col-method" style={{ flex: '0 0 100px' }}>Tipo</span>
              <span className="col-method" style={{ flex: '0 0 90px' }}>Estado</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Deuda</span>
              <span className="col-action" style={{ flex: '0 0 130px' }}></span>
            </div>
            {filtered.map((s: Socio) => (
              <div key={s.id} className="sales-table-row">
                <span className="col-date" style={{ flex: '0 0 70px', fontWeight: 500 }}>#{s.nroSocio}</span>
                <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>
                  {s.apellido}, {s.nombre}
                </span>
                <span className="col-method" style={{ flex: '0 0 100px' }}>
                  {s.socioTipo?.nombre || '--'}
                </span>
                <span className="col-method" style={{ flex: '0 0 90px' }}>
                  {estadoBadge(s.estado)}
                </span>
                <span className="col-total" style={{ flex: '0 0 100px' }}>
                  {(s.deudaTotal ?? 0) > 0 ? (
                    <span className="warning-text" style={{ fontWeight: 600 }}>{formatCurrency(s.deudaTotal ?? 0)}</span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>$0</span>
                  )}
                </span>
                <span className="col-action" style={{ flex: '0 0 130px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/admin/socios/${s.id}`)}>Ver</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/admin/socios/${s.id}/editar`)}>Editar</button>
                  {s.estado === 'ACTIVO' && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => handleDeactivate(s.id)}>Baja</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="fab-button-v2"
        onClick={() => navigate('/admin/socios/nuevo')}
        aria-label="Nuevo socio"
        title="Nuevo socio"
      >
        +
      </button>
    </div>
  );
};

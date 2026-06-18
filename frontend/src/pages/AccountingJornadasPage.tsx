import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAccountingCategories, useAccountingManualMovements } from '../api/queries';
import type { ManualMovementWithCategory } from '../api/types';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const normalizeApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response;
    const msg = resp?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : String(msg ?? 'Error desconocido');
  }
  return 'Error de conexión';
};

export const AccountingJornadasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{ from?: string; to?: string; type?: string }>({});
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [error, setError] = useState('');

  const { data: movements = [] } = useAccountingManualMovements(appliedFilters);
  const { data: categories = [] } = useAccountingCategories();

  const handleFilter = () => setAppliedFilters({ ...filters });

  const assignedCat = (m: ManualMovementWithCategory) =>
    m.manualMovementCategory?.category ?? null;

  const openAssign = (m: ManualMovementWithCategory) => {
    setAssignId(m.id);
    setSelectedCategoryId('');
    setError('');
  };

  const handleAssign = async () => {
    if (!assignId || !selectedCategoryId) return setError('Seleccioná una categoría');
    try {
      await apiClient.post(`/accounting/manual-movements/${assignId}/category`, {
        categoryId: selectedCategoryId,
      });
      setAssignId(null);
      queryClient.invalidateQueries({ queryKey: ['accounting-manual-movements'] });
    } catch (e) {
      setError(normalizeApiError(e));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiClient.delete(`/accounting/manual-movements/${id}/category`);
      queryClient.invalidateQueries({ queryKey: ['accounting-manual-movements'] });
    } catch (e) {
      alert(normalizeApiError(e));
    }
  };

  const compatibleCategories = categories.filter(
    (c) => {
      const mm = movements.find((m) => m.id === assignId);
      if (!mm) return false;
      return mm.type === 'ENTRADA' ? c.type === 'INCOME' : c.type === 'EXPENSE';
    }
  );

  return (
    <section className="card">
      <h2>Movimientos de jornada</h2>

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

      <div className="form-grid accounting-filters">
        <label className="input-field">
          Desde
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
          />
        </label>
        <label className="input-field">
          Hasta
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
          />
        </label>
        <label className="input-field">
          Tipo
          <select
            value={filters.type ?? ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
          </select>
        </label>
        <button className="secondary-button" onClick={handleFilter} style={{ alignSelf: 'flex-end' }}>
          Filtrar
        </button>
      </div>

      <div className="product-table" style={{ marginTop: '1rem' }}>
        <div className="product-table-header product-table-header--7">
          <span>ID</span>
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Monto</span>
          <span>Motivo</span>
          <span>Categoría</span>
          <span>Acciones</span>
        </div>
        {movements.map((m) => (
          <div className="product-table-row product-table-row--7" key={m.id}>
            <span title={m.id}>{m.id.slice(0, 8)}</span>
            <span>{formatDateTime(m.createdAt)}</span>
            <span className={m.type === 'ENTRADA' ? 'text-green' : 'text-red'}>
              {m.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
            </span>
            <span className={m.type === 'ENTRADA' ? 'text-green' : 'text-red'}>
              {formatCurrency(m.amount)}
            </span>
            <span>{m.reason}</span>
            <span>{assignedCat(m)?.name ?? <em className="text-muted">Sin categorizar</em>}</span>
            <span className="accounting-actions">
              {assignedCat(m) ? (
                <button className="ghost-button" onClick={() => handleRemove(m.id)}>Quitar categoría</button>
              ) : (
                <button className="ghost-button" onClick={() => openAssign(m)}>Asignar categoría</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {assignId && (
        <div className="modal-backdrop" onClick={() => setAssignId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Asignar categoría</h2>
              <button className="icon-button" onClick={() => setAssignId(null)}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <div className="error-text">{error}</div>}
              <label className="input-field">
                Categoría contable
                <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {compatibleCategories.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="checkout-actions">
              <button className="secondary-button" onClick={() => setAssignId(null)}>Cancelar</button>
              <button className="primary-button" onClick={handleAssign}>Asignar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

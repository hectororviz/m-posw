import { useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAccountingCategories, useAccountingMovements } from '../api/queries';
import type { AccountingMovement } from '../api/types';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const normalizeApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response;
    const msg = resp?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : String(msg ?? 'Error desconocido');
  }
  return 'Error de conexión';
};

export const AccountingMovementsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{
    from?: string;
    to?: string;
    type?: string;
    categoryId?: string;
  }>({});
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'EXPENSE' as string,
    amount: '',
    description: '',
    date: '',
    categoryId: '',
    refMovementId: '',
  });
  const [error, setError] = useState('');

  const { data: movements = [] } = useAccountingMovements(appliedFilters);
  const { data: categories = [] } = useAccountingCategories();

  const filteredCategories = categories.filter((c) => c.type === form.type);

  const handleFilter = () => {
    setAppliedFilters({ ...filters });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      type: 'EXPENSE',
      amount: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
      categoryId: '',
      refMovementId: '',
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (m: AccountingMovement) => {
    setEditingId(m.id);
    setForm({
      type: m.type,
      amount: String(m.amount),
      description: m.description,
      date: m.date.slice(0, 10),
      categoryId: m.categoryId,
      refMovementId: m.refMovementId ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.amount || Number(form.amount) <= 0) return setError('Ingresá un monto válido');
    if (!form.description.trim()) return setError('Ingresá una descripción');
    if (!form.date) return setError('Seleccioná una fecha');
    if (new Date(form.date) > new Date()) return setError('La fecha no puede ser futura');
    if (!form.categoryId) return setError('Seleccioná una categoría');

    try {
      if (editingId) {
        await apiClient.patch(`/accounting/movements/${editingId}`, {
          description: form.description,
          categoryId: form.categoryId,
          refMovementId: form.refMovementId || null,
        });
      } else {
        await apiClient.post('/accounting/movements', {
          type: form.type,
          amount: Number(form.amount),
          description: form.description,
          date: form.date,
          categoryId: form.categoryId,
          refMovementId: form.refMovementId || undefined,
        });
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['accounting-movements'] });
    } catch (e) {
      setError(normalizeApiError(e));
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    try {
      await apiClient.delete(`/accounting/movements/${id}`);
      queryClient.invalidateQueries({ queryKey: ['accounting-movements'] });
    } catch (e) {
      alert(normalizeApiError(e));
    }
  }, [queryClient]);

  return (
    <section className="card">
      <h2>Movimientos extra-jornada</h2>

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
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Egresos</option>
          </select>
        </label>
        <label className="input-field">
          Categoría
          <select
            value={filters.categoryId ?? ''}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {categories.filter((c) => !filters.type || c.type === filters.type).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" onClick={handleFilter} style={{ alignSelf: 'flex-end' }}>
          Filtrar
        </button>
      </div>

      <div className="product-table" style={{ marginTop: '1rem' }}>
        <div className="product-table-header product-table-header--8">
          <span>ID</span>
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Categoría</span>
          <span>Descripción</span>
          <span>Ref.</span>
          <span>Monto</span>
          <span>Acciones</span>
        </div>
        {movements.map((m) => (
          <div className="product-table-row product-table-row--8" key={m.id}>
            <span title={m.id}>{m.id.slice(0, 8)}</span>
            <span>{formatDate(m.date)}</span>
            <span className={m.type === 'INCOME' ? 'text-green' : 'text-red'}>
              {m.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
            </span>
            <span>{m.category?.name ?? '-'}</span>
            <span>{m.description}</span>
            <span title={m.refMovementId ?? ''}>{m.refMovementId?.slice(0, 8) ?? '-'}</span>
            <span className={m.type === 'INCOME' ? 'text-green' : 'text-red'}>
              {formatCurrency(m.amount)}
            </span>
            <span className="accounting-actions">
              <button className="ghost-button" onClick={() => openEdit(m)}>Editar</button>
              <button className="ghost-button" onClick={() => handleDelete(m.id)}>Eliminar</button>
            </span>
          </div>
        ))}
      </div>

      <button className="fab-button" onClick={openCreate} title="Nuevo movimiento">+</button>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
              <button className="icon-button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="error-text">{error}</div>}

              <label className="input-field">
                Tipo
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: '' })}
                  disabled={!!editingId}
                >
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </label>

              <label className="input-field">
                Fecha
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>

              <label className="input-field">
                Monto
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  disabled={!!editingId}
                />
              </label>

              <label className="input-field">
                Categoría
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {filteredCategories.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="input-field">
                Descripción
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </label>

              <label className="input-field">
                Movimiento de referencia (ID)
                <input
                  type="text"
                  value={form.refMovementId}
                  onChange={(e) => setForm({ ...form, refMovementId: e.target.value })}
                  placeholder="UUID del movimiento original (opcional)"
                />
              </label>
            </div>
            <div className="checkout-actions">
              <button className="secondary-button" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="primary-button" onClick={handleSubmit}>
                {editingId ? 'Guardar cambios' : 'Crear movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

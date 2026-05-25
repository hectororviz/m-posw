import { useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAccountingCategories } from '../api/queries';

const normalizeApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response;
    const msg = resp?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : String(msg ?? 'Error desconocido');
  }
  return 'Error de conexión';
};

export const AccountingCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useAccountingCategories();
  const [showCreate, setShowCreate] = useState<{ type: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [createName, setCreateName] = useState('');
  const [error, setError] = useState('');

  const incomeCategories = categories.filter((c) => c.type === 'INCOME');
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['accounting-categories'] });

  const handleCreate = async () => {
    if (!createName.trim()) return setError('Ingresá un nombre');
    try {
      await apiClient.post('/accounting/categories', {
        name: createName.trim(),
        type: showCreate!.type,
      });
      setShowCreate(null);
      setCreateName('');
      setError('');
      invalidate();
    } catch (e) {
      setError(normalizeApiError(e));
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await apiClient.patch(`/accounting/categories/${id}`, { name: editName.trim() });
      setEditingId(null);
      invalidate();
    } catch (e) {
      alert(normalizeApiError(e));
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await apiClient.patch(`/accounting/categories/${id}`, { active: !active });
      invalidate();
    } catch (e) {
      alert(normalizeApiError(e));
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta categoría? Solo se puede si no tiene movimientos.')) return;
    try {
      await apiClient.delete(`/accounting/categories/${id}`);
      invalidate();
    } catch (e) {
      alert(normalizeApiError(e));
    }
  }, []);

  const renderSection = (title: string, list: typeof categories, type: string) => (
    <div className="accounting-category-section">
      <div className="accounting-category-section-header">
        <h3>{title}</h3>
        <button className="secondary-button" onClick={() => { setShowCreate({ type }); setCreateName(''); setError(''); }}>
          Nueva categoría
        </button>
      </div>
      <div className="product-table">
        <div className="product-table-header product-table-header--4">
          <span>Nombre</span>
          <span>Estado</span>
          <span>Movimientos</span>
          <span>Acciones</span>
        </div>
        {list.map((c) => (
          <div className="product-table-row product-table-row--4" key={c.id}>
            {editingId === c.id ? (
              <span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdate(c.id)}
                  autoFocus
                  style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                />
              </span>
            ) : (
              <span>{c.name}</span>
            )}
            <span>
              <span className={c.active ? 'badge badge-active' : 'badge badge-inactive'}>
                {c.active ? 'Activa' : 'Inactiva'}
              </span>
            </span>
            <span>{c._count?.movements ?? 0}</span>
            <span className="accounting-actions">
              {editingId === c.id ? (
                <>
                  <button className="ghost-button" onClick={() => handleUpdate(c.id)}>Guardar</button>
                  <button className="ghost-button" onClick={() => setEditingId(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <button className="ghost-button" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                    Editar
                  </button>
                  <button className="ghost-button" onClick={() => handleToggle(c.id, c.active)}>
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                  {!c._count?.movements && (
                    <button className="ghost-button" onClick={() => handleDelete(c.id)}>Eliminar</button>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <div className="product-table-row product-table-row--4">
            <span style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9ca3af' }}>
              Sin categorías
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="card">
      <h2>Categorías contables</h2>

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

      {renderSection('Ingresos', incomeCategories, 'INCOME')}
      {renderSection('Egresos', expenseCategories, 'EXPENSE')}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Nueva categoría ({showCreate.type === 'INCOME' ? 'Ingreso' : 'Egreso'})</h2>
              <button className="icon-button" onClick={() => setShowCreate(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="error-text">{error}</div>}
              <label className="input-field">
                Nombre
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </label>
            </div>
            <div className="checkout-actions">
              <button className="secondary-button" onClick={() => setShowCreate(null)}>Cancelar</button>
              <button className="primary-button" onClick={handleCreate}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

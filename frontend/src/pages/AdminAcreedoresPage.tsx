import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useAcreedores, useAcreedoresResumen } from '../api/queries';
import type { Acreedor } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type SortMode = 'alpha' | 'deuda';

const getAntiguedadLabel = (dias: number | null | undefined, saldo: number) => {
  if (!dias || saldo <= 0) return '--';
  return `${dias}d`;
};

const getAntiguedadColor = (dias: number | null | undefined, saldo: number): string => {
  if (!dias || saldo <= 0) return '';
  if (dias >= 30) return 'var(--color-danger)';
  if (dias >= 15) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-success)';
};

export const AdminAcreedoresPage: React.FC = () => {
  const { data: acreedores = [], isLoading } = useAcreedores();
  const { data: resumen } = useAcreedoresResumen();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', notas: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alpha');

  const computed = useMemo(() => {
    return acreedores.map((a) => {
      const saldo =
        a.alertaDeuda !== undefined
          ? 0 // saldo will be shown via separate state, compute from data
          : 0;
      return { ...a, __saldo: saldo };
    });
  }, [acreedores]);

  const filtered = useMemo(() => {
    let list = computed.map((a) => {
      const totalFiado = (a as any).fiadoVentas
        ? (a as any).fiadoVentas.reduce((sum: number, fv: any) => sum + Number(fv.monto), 0)
        : 0;
      const totalPagado = (a as any).pagos
        ? (a as any).pagos.reduce((sum: number, p: any) => sum + Number(p.monto), 0)
        : 0;
      return { ...a, __saldo: totalFiado - totalPagado };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.nombre.toLowerCase().includes(q));
    }

    if (sortMode === 'deuda') {
      list.sort((a, b) => (b as any).__saldo - (a as any).__saldo);
    } else {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return list;
  }, [computed, search, sortMode]);

  const resetForm = () => {
    setForm({ nombre: '', telefono: '', notas: '', activo: true });
    setEditingId(null);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    const a = acreedores.find((ac) => ac.id === id);
    if (!a) return;
    setForm({ nombre: a.nombre, telefono: a.telefono ?? '', notas: a.notas ?? '', activo: a.activo });
    setEditingId(id);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiClient.patch(`/acreedores/${editingId}`, {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          notas: form.notas || undefined,
        });
        const acreedor = acreedores.find((a) => a.id === editingId);
        if (acreedor && acreedor.activo !== form.activo) {
          await apiClient.patch(`/acreedores/${editingId}/toggle`);
        }
        pushToast('Acreedor actualizado', 'success');
      } else {
        await apiClient.post('/acreedores', {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          notas: form.notas || undefined,
        });
        pushToast('Acreedor creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['acreedores'] });
      await queryClient.invalidateQueries({ queryKey: ['acreedores-resumen'] });
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const getSaldoDisplay = (a: Acreedor & { __saldo: number }) => {
    if (a.__saldo > 0) {
      if (a.alertaDeuda) {
        return <span className="error-text" style={{ fontWeight: 600 }}>{formatCurrency(a.__saldo)}</span>;
      }
      return <span className="warning-text">{formatCurrency(a.__saldo)}</span>;
    }
    return <span style={{ color: 'var(--color-text-muted)' }}>$0</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Acreedores</h2>
            <p className="page-header-subtitle">Control de ventas fiadas y pagos de acreedores.</p>
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
            <span className="sales-kpi-label">Acreedores con deuda</span>
            <span className="sales-kpi-value">{resumen.acreedoresConDeuda}</span>
          </div>
        </div>
      )}

      <div className="stock-toolbar">
        <input
          type="text"
          className="stock-search-input"
          placeholder="Buscar acreedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sort-segmented">
          <button
            type="button"
            className={`sort-segment ${sortMode === 'alpha' ? 'sort-segment--active' : ''}`}
            onClick={() => setSortMode('alpha')}
          >
            ABC
          </button>
          <button
            type="button"
            className={`sort-segment ${sortMode === 'deuda' ? 'sort-segment--active' : ''}`}
            onClick={() => setSortMode('deuda')}
          >
            $$$
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" aria-hidden="true" />
          <p style={{ color: 'var(--color-text-faint)', margin: '0.75rem 0 0', fontSize: '0.95rem' }}>Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', margin: 0, fontSize: '0.95rem' }}>
            {search ? 'Sin resultados para la busqueda.' : 'No hay acreedores registrados.'}
          </p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-date">Nombre</span>
              <span className="col-user">Telefono</span>
              <span className="col-total" style={{ flex: '0 0 110px' }}>Saldo</span>
              <span className="col-total" style={{ flex: '0 0 90px' }}>Antiguedad</span>
              <span className="col-method" style={{ flex: '0 0 70px' }}>Estado</span>
              <span className="col-action" style={{ flex: '0 0 90px' }}></span>
            </div>
            {filtered.map((a) => (
              <div key={a.id} className="sales-table-row">
                <span className="col-date" style={{ fontWeight: 500 }}>{a.nombre}</span>
                <span className="col-user">{a.telefono || '--'}</span>
                <span className="col-total" style={{ flex: '0 0 110px' }}>{getSaldoDisplay(a)}</span>
                <span
                  className="col-total"
                  style={{
                    flex: '0 0 90px',
                    color: getAntiguedadColor(a.diasSinPagar, (a as any).__saldo),
                    fontWeight: 500,
                  }}
                >
                  {getAntiguedadLabel(a.diasSinPagar, (a as any).__saldo)}
                </span>
                <span className="col-method" style={{ flex: '0 0 70px' }}>
                  {a.activo ? (
                    <span className="badge badge-success">Activo</span>
                  ) : (
                    <span className="badge badge-neutral">Inactivo</span>
                  )}
                </span>
                <span className="col-action" style={{ flex: '0 0 90px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(`/admin/acreedores/${a.id}`)}>Ver</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(a.id)}>Editar</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="fab-button-v2"
        onClick={openCreate}
        aria-label="Nuevo acreedor"
        title="Nuevo acreedor"
      >
        +
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar acreedor' : 'Nuevo acreedor'}</h3>
              <button className="icon-button" onClick={() => { setModalOpen(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              <div className="settings-field">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del acreedor"
                />
              </div>
              <div className="settings-field">
                <label>Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Telefono"
                />
              </div>
              <div className="settings-field">
                <label>Notas</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Notas adicionales"
                />
              </div>
              {editingId && (
                <div className="settings-field">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    <span className="toggle-switch-track" />
                    Activo
                  </label>
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { apiClient, normalizeApiError } from '../api/client';
import { useSociosTipos } from '../api/queries';
import { useToast } from '../components/ToastProvider';

interface Beneficio {
  id: string;
  socioTipoId: number;
  categoriaProdId: string;
  porcentaje: number;
  descuentoMaximo?: number | null;
  limiteDiario?: number | null;
  activo: boolean;
  socioTipo: { id: number; nombre: string };
  categoria: { id: string; name: string };
  createdAt: string;
}

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const AdminSociosBeneficiosPage: React.FC = () => {
  const { pushToast } = useToast();
  const { data: tipos = [] } = useSociosTipos();
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    socioTipoId: '',
    categoriaProdId: '',
    porcentaje: '',
    descuentoMaximo: '',
    limiteDiario: '',
    activo: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [categorias, setCategorias] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = filterTipo ? `?socioTipoId=${filterTipo}` : '';
    apiClient.get<Beneficio[]>(`/socios/beneficios${params}`)
      .then((res) => setBeneficios(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterTipo, refresh]);

  const fetchCategorias = async () => {
    try {
      const res = await apiClient.get<any[]>('/categories');
      setCategorias(res.data.filter((c: any) => c.active));
    } catch (_) {}
  };

  const resetForm = () => {
    setForm({ socioTipoId: '', categoriaProdId: '', porcentaje: '', descuentoMaximo: '', limiteDiario: '', activo: true });
    setEditingId(null);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    fetchCategorias();
    setModalOpen(true);
  };

  const openEdit = (b: Beneficio) => {
    setEditingId(b.id);
    setForm({
      socioTipoId: String(b.socioTipoId),
      categoriaProdId: b.categoriaProdId,
      porcentaje: String(b.porcentaje),
      descuentoMaximo: b.descuentoMaximo ? String(b.descuentoMaximo) : '',
      limiteDiario: b.limiteDiario ? String(b.limiteDiario) : '',
      activo: b.activo,
    });
    fetchCategorias();
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.socioTipoId || !form.categoriaProdId || !form.porcentaje) {
      setError('Tipo de socio, categoria y porcentaje son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        socioTipoId: Number(form.socioTipoId),
        categoriaProdId: form.categoriaProdId,
        porcentaje: Number(form.porcentaje),
        descuentoMaximo: form.descuentoMaximo ? Number(form.descuentoMaximo) : undefined,
        limiteDiario: form.limiteDiario ? Number(form.limiteDiario) : undefined,
        activo: form.activo,
      };

      if (editingId) {
        await apiClient.put(`/socios/beneficios/${editingId}`, payload);
        pushToast('Beneficio actualizado', 'success');
      } else {
        await apiClient.post('/socios/beneficios', payload);
        pushToast('Beneficio creado', 'success');
      }
      setModalOpen(false);
      resetForm();
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/socios/beneficios/${id}`);
      pushToast('Beneficio eliminado', 'success');
      setRefresh((r) => r + 1);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const handleToggle = async (b: Beneficio) => {
    try {
      await apiClient.put(`/socios/beneficios/${b.id}`, { activo: !b.activo });
      pushToast(b.activo ? 'Beneficio desactivado' : 'Beneficio activado', 'success');
      setRefresh((r) => r + 1);
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Beneficios</h2>
        <p className="page-header-subtitle">Descuentos por tipo de socio y categoria de producto.</p>
      </div>

      <div className="stock-toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <select
          className="stock-search-input"
          style={{ flex: '0 0 auto', maxWidth: '220px' }}
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div className="spinner" />
        </div>
      ) : beneficios.length === 0 ? (
        <div className="settings-section" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)' }}>No hay beneficios registrados.</p>
        </div>
      ) : (
        <div className="sales-table-wrapper">
          <div className="sales-table">
            <div className="sales-table-head">
              <span className="col-user" style={{ flex: '0 0 120px' }}>Tipo</span>
              <span className="col-user" style={{ flex: '0 0 140px' }}>Categoria</span>
              <span className="col-total" style={{ flex: '0 0 90px' }}>Descuento</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Tope max</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Limite diario</span>
              <span className="col-method" style={{ flex: '0 0 80px' }}>Estado</span>
              <span className="col-action" style={{ flex: '0 0 160px' }}></span>
            </div>
            {beneficios.map((b) => (
              <div key={b.id} className="sales-table-row">
                <span className="col-user" style={{ flex: '0 0 120px', fontWeight: 500 }}>{b.socioTipo.nombre}</span>
                <span className="col-user" style={{ flex: '0 0 140px' }}>{b.categoria.name}</span>
                <span className="col-total" style={{ flex: '0 0 90px', fontWeight: 600 }}>{b.porcentaje}%</span>
                <span className="col-total" style={{ flex: '0 0 100px' }}>
                  {b.descuentoMaximo ? formatCurrency(Number(b.descuentoMaximo)) : <span style={{ color: 'var(--color-text-muted)' }}>Sin tope</span>}
                </span>
                <span className="col-total" style={{ flex: '0 0 100px' }}>
                  {b.limiteDiario ? `${b.limiteDiario}/dia` : <span style={{ color: 'var(--color-text-muted)' }}>Ilimitado</span>}
                </span>
                <span className="col-method" style={{ flex: '0 0 80px' }}>
                  {b.activo ? <span className="badge badge-success">Activo</span> : <span className="badge badge-neutral">Inactivo</span>}
                </span>
                <span className="col-action" style={{ flex: '0 0 160px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(b)}>Editar</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => handleToggle(b)}>{b.activo ? 'Desactivar' : 'Activar'}</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => handleDelete(b.id)}>Eliminar</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo beneficio">+</button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar beneficio' : 'Nuevo beneficio'}</h3>
              <button className="icon-button" onClick={() => { setModalOpen(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="settings-field">
                  <label>Tipo de socio *</label>
                  <select value={form.socioTipoId} onChange={(e) => setForm({ ...form, socioTipoId: e.target.value })}>
                    <option value="">Seleccionar tipo</option>
                    {tipos.filter(t => t.activo).map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Categoria de producto *</label>
                  <select value={form.categoriaProdId} onChange={(e) => setForm({ ...form, categoriaProdId: e.target.value })}>
                    <option value="">Seleccionar categoria</option>
                    {categorias.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Porcentaje de descuento (%) *</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.porcentaje}
                    onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} placeholder="10" />
                </div>
                <div className="settings-field">
                  <label>Descuento maximo ($)</label>
                  <input type="number" min="0" step="0.01" value={form.descuentoMaximo}
                    onChange={(e) => setForm({ ...form, descuentoMaximo: e.target.value })} placeholder="Sin tope" />
                </div>
                <div className="settings-field">
                  <label>Limite de canjes por dia</label>
                  <input type="number" min="1" step="1" value={form.limiteDiario}
                    onChange={(e) => setForm({ ...form, limiteDiario: e.target.value })} placeholder="Ilimitado" />
                </div>
                <div className="settings-field">
                  <label className="toggle-switch">
                    <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                    <span className="toggle-switch-track" />
                    Activo
                  </label>
                </div>
              </div>
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

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useSocios, useSociosTipos, useSociosTesoreriaResumen, useSocio, useSocioCuotas, useTreasuryAccounts } from '../api/queries';
import type { Socio, SocioCuotaItem } from '../api/types';
import { useToast } from '../components/ToastProvider';

const formatCurrency = (value: number) =>
  `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const estadoBadge = (estado: string) => {
  if (estado === 'ACTIVO') return <span className="badge badge-success">Activo</span>;
  if (estado === 'SUSPENDIDO') return <span className="badge badge-warning">Suspendido</span>;
  return <span className="badge badge-neutral">Inactivo</span>;
};

const cuotaEstadoBadge = (estado: string) => {
  if (estado === 'PAGADO') return <span className="badge badge-success">Pagado</span>;
  if (estado === 'PARCIAL') return <span className="badge badge-warning">Parcial</span>;
  return <span className="badge badge-danger">Pendiente</span>;
};

type ModalMode = 'create' | 'view' | 'edit' | 'pay' | null;

const emptyForm = {
  nroSocio: '',
  dni: '',
  apellido: '',
  nombre: '',
  fechaNacimiento: '',
  telefono: '',
  direccion: '',
  socioTipoId: '',
  fechaAlta: new Date().toISOString().slice(0, 10),
  estado: 'ACTIVO' as string,
};

const emptyPagoForm = {
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  observacion: '',
  treasuryAccountId: '',
};

export const AdminSociosPage: React.FC = () => {
  const [filters, setFilters] = useState<{ estado?: string; socioTipoId?: string; deuda?: string }>({});
  const { data: socios = [], isLoading } = useSocios(filters);
  const { data: resumen } = useSociosTesoreriaResumen();
  const { data: tipos = [] } = useSociosTipos();
  const { data: treasuryAccounts = [] } = useTreasuryAccounts();
  const autoTreasuryId = treasuryAccounts.length === 1 ? treasuryAccounts[0].id : '';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ─── Modal state ──────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Detail modal ─────────────────────────────────────
  const { data: viewedSocio } = useSocio(modalMode === 'view' && selectedId ? selectedId : undefined);
  const { data: viewedCuotas = [], isLoading: cuotasLoading } = useSocioCuotas(
    modalMode === 'view' && selectedId ? selectedId : undefined,
  );

  // ─── Pago modal (dentro del modal de detalle) ─────────
  const [pagoModal, setPagoModal] = useState(false);
  const [pagoCuotaId, setPagoCuotaId] = useState<number | null>(null);
  const [pagoForm, setPagoForm] = useState(emptyPagoForm);

  // ─── Pago masivo (desde la tabla) ─────────────────────
  const [pagoMasivoSocioId, setPagoMasivoSocioId] = useState<number | null>(null);
  const { data: pagoMasivoCuotas = [], isLoading: pagoMasivoLoading } = useSocioCuotas(
    modalMode === 'pay' && pagoMasivoSocioId ? pagoMasivoSocioId : undefined,
  );
  const [pagoMasivoChecked, setPagoMasivoChecked] = useState<Record<number, boolean>>({});
  const [pagoMasivoTotal, setPagoMasivoTotal] = useState('');
  const [pagoMasivoFecha, setPagoMasivoFecha] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [pagoMasivoError, setPagoMasivoError] = useState<string | null>(null);
  const [pagoMasivoSaving, setPagoMasivoSaving] = useState(false);
  const [pagoMasivoInputMode, setPagoMasivoInputMode] = useState<'total' | 'check'>('check');
  const [pagoMasivoTreasuryId, setPagoMasivoTreasuryId] = useState(autoTreasuryId);
  const [pagoMasivoPartialMonth, setPagoMasivoPartialMonth] = useState<{
    cuotaId: number;
    mes: number;
    anio: number;
    monto: number;
    saldo: number;
  } | null>(null);

  // ─── Filters ──────────────────────────────────────────
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

  // ─── Close modal ──────────────────────────────────────
  const closeModal = () => {
    setModalMode(null);
    setSelectedId(null);
    setFormTab(0);
    setError(null);
    setSaving(false);
    setPagoModal(false);
    setPagoCuotaId(null);
    setPagoMasivoSocioId(null);
    setPagoMasivoChecked({});
    setPagoMasivoTotal('');
    setPagoMasivoError(null);
    setPagoMasivoSaving(false);
    setPagoMasivoInputMode('check');
    setPagoMasivoPartialMonth(null);
    setPagoMasivoTreasuryId(autoTreasuryId);
  };

  // ─── Create ───────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm);
    setFormTab(0);
    setModalMode('create');
  };

  // ─── View ─────────────────────────────────────────────
  const openView = (id: number) => {
    setSelectedId(id);
    setModalMode('view');
  };

  // ─── Edit ─────────────────────────────────────────────
  const openEdit = (id: number) => {
    const s = socios.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(id);
    setFormTab(0);
    setForm({
      nroSocio: String(s.nroSocio),
      dni: s.dni,
      apellido: s.apellido,
      nombre: s.nombre,
      fechaNacimiento: s.fechaNacimiento ? s.fechaNacimiento.slice(0, 10) : '',
      telefono: s.telefono ?? '',
      direccion: s.direccion ?? '',
      socioTipoId: String(s.socioTipoId),
      fechaAlta: s.fechaAlta.slice(0, 10),
      estado: s.estado,
    });
    setModalMode('edit');
  };

  // ─── Save (create / update) ───────────────────────────
  const handleSave = async () => {
    if (!form.apellido.trim() || !form.nombre.trim() || !form.dni.trim()) {
      setError('Apellido, nombre y DNI son obligatorios');
      return;
    }
    if (!form.nroSocio || !form.socioTipoId) {
      setError('Numero de socio y tipo son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nroSocio: Number(form.nroSocio),
        dni: form.dni,
        apellido: form.apellido,
        nombre: form.nombre,
        fechaNacimiento: form.fechaNacimiento || undefined,
        telefono: form.telefono || undefined,
        direccion: form.direccion || undefined,
        socioTipoId: Number(form.socioTipoId),
        fechaAlta: form.fechaAlta,
        estado: form.estado,
      };

      if (modalMode === 'edit' && selectedId) {
        await apiClient.put(`/socios/${selectedId}`, payload);
        pushToast('Socio actualizado', 'success');
      } else {
        await apiClient.post('/socios', payload);
        pushToast('Socio creado', 'success');
      }
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
      await queryClient.invalidateQueries({ queryKey: ['socios-tesoreria-resumen'] });
      closeModal();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Pago de cuota ────────────────────────────────────
  const openPagoModal = (cuota: SocioCuotaItem) => {
    setPagoCuotaId(cuota.id);
    const pendiente = Number(cuota.montoOriginal) - Number(cuota.montoPagado);
    setPagoForm({
      monto: String(pendiente),
      fecha: new Date().toISOString().slice(0, 10),
      observacion: '',
      treasuryAccountId: autoTreasuryId,
    });
    setError(null);
    setPagoModal(true);
  };

  const handlePagoSave = async () => {
    const monto = Number(pagoForm.monto);
    if (!monto || monto <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!pagoForm.treasuryAccountId) {
      setError('Selecciona dónde ingresó el dinero');
      return;
    }
    if (!pagoCuotaId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/socios/cuotas/${pagoCuotaId}/pagar`, {
        monto,
        fecha: pagoForm.fecha,
        observacion: pagoForm.observacion || undefined,
        treasuryAccountId: pagoForm.treasuryAccountId,
      });
      await queryClient.invalidateQueries({ queryKey: ['socio-cuotas', selectedId] });
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
      await queryClient.invalidateQueries({ queryKey: ['socios-tesoreria-resumen'] });
      pushToast('Pago registrado', 'success');
      setPagoModal(false);
      setPagoCuotaId(null);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Pago masivo ───────────────────────────────────────
  const openPayModal = async (id: number) => {
    setPagoMasivoSocioId(id);
    setPagoMasivoChecked({});
    setPagoMasivoTotal('');
    setPagoMasivoFecha(new Date().toISOString().slice(0, 10));
    setPagoMasivoError(null);
    setPagoMasivoSaving(false);
    setPagoMasivoInputMode('check');
    setPagoMasivoPartialMonth(null);
    setModalMode('pay');

    // Generar cuotas faltantes de meses vencidos (idempotente)
    const ahora = new Date();
    const anio = ahora.getUTCFullYear();
    try {
      await Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1;
          const dia10 = new Date(Date.UTC(anio, mes - 1, 10, 12, 0, 0));
          if (ahora >= dia10) {
            return apiClient.post('/socios/cuotas/generar', { anio, mes });
          }
          return Promise.resolve();
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['socio-cuotas', id] });
      await queryClient.invalidateQueries({ queryKey: ['socios'] });
    } catch (_) {
      // Si falla la generación, continuamos igual
    }
  };

  const cuotasAdeudadas = useMemo(() => {
    return pagoMasivoCuotas
      .filter((c) => c.estado !== 'PAGADO')
      .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
      .map((c) => ({
        ...c,
        saldo: Number(c.montoOriginal) - Number(c.montoPagado),
      }));
  }, [pagoMasivoCuotas]);

  const sumChecked = () => {
    let total = 0;
    for (const c of cuotasAdeudadas) {
      if (pagoMasivoChecked[c.id]) {
        total += c.saldo;
      }
    }
    return total;
  };

  const handleToggleCheck = (cuotaId: number) => {
    setPagoMasivoInputMode('check');
    setPagoMasivoPartialMonth(null);
    setPagoMasivoChecked((prev) => {
      const next = { ...prev, [cuotaId]: !prev[cuotaId] };
      const total = cuotasAdeudadas
        .filter((c) => next[c.id])
        .reduce((s, c) => s + c.saldo, 0);
      setPagoMasivoTotal(total > 0 ? String(total) : '');
      return next;
    });
  };

  const handleTotalChange = (raw: string) => {
    setPagoMasivoInputMode('total');
    setPagoMasivoTotal(raw);
    setPagoMasivoPartialMonth(null);

    const monto = Number(raw);
    if (!monto || monto <= 0 || isNaN(monto)) {
      setPagoMasivoChecked({});
      return;
    }

    let restante = monto;
    const newChecked: Record<number, boolean> = {};
    let partial: typeof pagoMasivoPartialMonth = null;

    for (const c of cuotasAdeudadas) {
      if (restante <= 0) break;
      if (restante >= c.saldo) {
        newChecked[c.id] = true;
        restante = Math.round((restante - c.saldo) * 100) / 100;
      } else {
        newChecked[c.id] = true;
        partial = {
          cuotaId: c.id,
          mes: c.mes,
          anio: c.anio,
          monto: restante,
          saldo: c.saldo,
        };
        restante = 0;
        break;
      }
    }

    setPagoMasivoPartialMonth(partial);
    setPagoMasivoChecked(newChecked);
  };

  const handleConfirmPagoMasivo = async () => {
    const selected = cuotasAdeudadas.filter((c) => pagoMasivoChecked[c.id]);
    if (selected.length === 0) return;

    if (!pagoMasivoTreasuryId) {
      setPagoMasivoError('Selecciona dónde ingresó el dinero');
      return;
    }

    setPagoMasivoSaving(true);
    setPagoMasivoError(null);

    for (const c of selected) {
      let monto = c.saldo;
      if (
        pagoMasivoPartialMonth &&
        pagoMasivoPartialMonth.cuotaId === c.id
      ) {
        monto = pagoMasivoPartialMonth.monto;
      }

      try {
        await apiClient.post(`/socios/cuotas/${c.id}/pagar`, {
          monto,
          fecha: pagoMasivoFecha,
          treasuryAccountId: pagoMasivoTreasuryId,
        });
      } catch (err) {
        setPagoMasivoError(
          `Error al pagar ${MONTH_NAMES_FULL[c.mes - 1]} ${c.anio}: ${normalizeApiError(err)}`,
        );
        setPagoMasivoSaving(false);
        return;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['socios'] });
    await queryClient.invalidateQueries({ queryKey: ['socios-tesoreria-resumen'] });
    await queryClient.invalidateQueries({ queryKey: ['socio-cuotas', pagoMasivoSocioId] });
    pushToast('Pago registrado correctamente', 'success');
    closeModal();
  };

  // ─── Carnet ───────────────────────────────────────────
  const handleCarnet = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${baseUrl}/socios/${selectedId}/carnet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Error al generar el carnet');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      pushToast('Error al generar el carnet', 'error');
    }
  };

  // ─── Seleccion multiple ─────────────────────────────
  const toggleSelectSocio = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleBulkCarnet = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${baseUrl}/socios/carnets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!resp.ok) throw new Error('Error al generar los carnets');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setSelectedIds(new Set());
    } catch (err) {
      pushToast('Error al generar los carnets', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title" style={{ marginBottom: '0.15rem' }}>Socios</h2>
        <p className="page-header-subtitle">Gestion del padron de socios del club.</p>
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
              <span style={{ flex: '0 0 36px', display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
              </span>
              <span className="col-date" style={{ flex: '0 0 70px' }}>Nº</span>
              <span className="col-user" style={{ flex: 1 }}>Apellido y Nombre</span>
              <span className="col-method" style={{ flex: '0 0 100px' }}>Tipo</span>
              <span className="col-method" style={{ flex: '0 0 90px' }}>Estado</span>
              <span className="col-total" style={{ flex: '0 0 100px' }}>Deuda</span>
              <span className="col-action" style={{ flex: '0 0 180px' }}></span>
            </div>
            {filtered.map((s: Socio) => (
              <div key={s.id} className="sales-table-row">
                <span style={{ flex: '0 0 36px', display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelectSocio(s.id)} />
                </span>
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
                <span className="col-action" style={{ flex: '0 0 180px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openView(s.id)}>Ver</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(s.id)}>Editar</button>
                  {(s.deudaTotal ?? 0) > 0 && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openPayModal(s.id)}>Pagar</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length > 0 && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-count">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
          <button type="button" className="btn-primary" onClick={handleBulkCarnet}>
            Generar carnets
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSelectedIds(new Set())}>
            Cancelar
          </button>
        </div>
      )}

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo socio" title="Nuevo socio"><Plus size={24} /></button>

      {/* ─── Modal: Create / Edit ─────────────────────── */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'edit' ? 'Editar socio' : 'Nuevo socio'}</h3>
              <button className="icon-button" onClick={closeModal}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

              {/* Tab navigation */}
              <div className="sort-segmented" style={{ marginBottom: '1rem', width: '100%', display: 'flex' }}>
                {['Datos personales', 'Socio', 'Contacto'].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`sort-segment ${formTab === i ? 'sort-segment--active' : ''}`}
                    onClick={() => setFormTab(i)}
                    style={{ flex: 1 }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab 0: Datos personales */}
              {formTab === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="settings-field">
                    <label>Nombre *</label>
                    <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
                  </div>
                  <div className="settings-field">
                    <label>Apellido *</label>
                    <input type="text" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} placeholder="Apellido" />
                  </div>
                  <div className="settings-field">
                    <label>DNI *</label>
                    <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} placeholder="DNI" />
                  </div>
                  <div className="settings-field">
                    <label>Fecha de Nacimiento</label>
                    <input type="date" value={form.fechaNacimiento} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Tab 1: Socio */}
              {formTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="settings-field">
                    <label>Numero de Socio *</label>
                    <input type="number" value={form.nroSocio} onChange={(e) => setForm({ ...form, nroSocio: e.target.value })} placeholder="Numero" />
                  </div>
                  <div className="settings-field">
                    <label>Tipo *</label>
                    <select value={form.socioTipoId} onChange={(e) => setForm({ ...form, socioTipoId: e.target.value })}>
                      <option value="">Seleccionar tipo</option>
                      {tipos.filter(t => t.activo).map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-field">
                    <label>Fecha de Alta *</label>
                    <input type="date" value={form.fechaAlta} onChange={(e) => setForm({ ...form, fechaAlta: e.target.value })} />
                  </div>
                  <div className="settings-field">
                    <label>Estado</label>
                    <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                      <option value="SUSPENDIDO">Suspendido</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tab 2: Contacto */}
              {formTab === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="settings-field">
                    <label>Telefono</label>
                    <input type="text" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Telefono" />
                  </div>
                  <div className="settings-field">
                    <label>Direccion</label>
                    <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Direccion" />
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: View Detail ────────────────────────── */}
      {modalMode === 'view' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ width: '960px', maxWidth: '98vw', maxHeight: '92vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>{viewedSocio ? `${viewedSocio.apellido}, ${viewedSocio.nombre}` : 'Cargando...'}</h3>
              <button className="icon-button" onClick={closeModal}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {!viewedSocio ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
              ) : (() => {
                const s = viewedSocio;
                const fechaAlta = new Date(s.fechaAlta);
                const mesAlta = MONTH_NAMES_FULL[fechaAlta.getUTCMonth()];
                const anioAlta = fechaAlta.getUTCFullYear();
                const deudaTotal = viewedCuotas
                  .filter((c) => c.estado !== 'PAGADO')
                  .reduce((sum, c) => sum + (Number(c.montoOriginal) - Number(c.montoPagado)), 0);

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>DNI: {s.dni}</p>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Nº Socio: #{s.nroSocio}</p>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Miembro desde: {mesAlta} {anioAlta}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        {estadoBadge(s.estado)}
                        <span className="badge badge-neutral" style={{ fontSize: '0.82rem' }}>{s.socioTipo?.nombre}</span>
                      </div>
                    </div>

                    <div className="sales-kpis" style={{ marginBottom: '1rem' }}>
                      <div className="sales-kpi-card">
                        <span className="sales-kpi-label">Deuda pendiente</span>
                        <span className={`sales-kpi-value ${deudaTotal > 0 ? 'warning-text' : 'success-text'}`} style={{ fontSize: '1rem' }}>
                          {formatCurrency(deudaTotal)}
                        </span>
                      </div>
                      <div className="sales-kpi-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button type="button" className="btn-ghost" onClick={() => { closeModal(); setTimeout(() => openEdit(s.id), 100); }}>Editar</button>
                        <button type="button" className="btn-primary" onClick={handleCarnet}>Generar carnet</button>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h3 className="settings-section-header">Cuotas</h3>
                      {cuotasLoading ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
                      ) : viewedCuotas.length === 0 ? (
                        <p style={{ color: 'var(--color-text-faint)' }}>No hay cuotas registradas.</p>
                      ) : (
                        <div className="sales-table">
                          <div className="sales-table-head">
                            <span className="col-date" style={{ flex: '0 0 100px' }}>Periodo</span>
                            <span className="col-total" style={{ flex: '0 0 85px' }}>Monto</span>
                            <span className="col-total" style={{ flex: '0 0 85px' }}>Pagado</span>
                            <span className="col-total" style={{ flex: '0 0 85px' }}>Pendiente</span>
                            <span className="col-method" style={{ flex: '0 0 80px' }}>Estado</span>
                            <span className="col-user" style={{ flex: 1 }}>Pagos</span>
                            <span className="col-action" style={{ flex: '0 0 70px' }}></span>
                          </div>
                          {viewedCuotas.map((c: SocioCuotaItem) => {
                            const pendiente = Math.max(0, Number(c.montoOriginal) - Number(c.montoPagado));
                            return (
                              <div key={c.id} className="sales-table-row">
                                <span className="col-date" style={{ flex: '0 0 100px' }}>{MONTH_NAMES[c.mes - 1]} {c.anio}</span>
                                <span className="col-total" style={{ flex: '0 0 85px' }}>{formatCurrency(Number(c.montoOriginal))}</span>
                                <span className="col-total" style={{ flex: '0 0 85px', color: 'var(--color-success)' }}>{formatCurrency(Number(c.montoPagado))}</span>
                                <span className="col-total" style={{ flex: '0 0 85px', color: pendiente > 0 ? 'var(--color-danger)' : undefined, fontWeight: pendiente > 0 ? 600 : undefined }}>{formatCurrency(pendiente)}</span>
                                <span className="col-method" style={{ flex: '0 0 80px' }}>{cuotaEstadoBadge(c.estado)}</span>
                                <span className="col-user" style={{ flex: 1, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                  {c.pagos && c.pagos.length > 0
                                    ? c.pagos.map((p) => `${formatDate(p.fecha)} $${p.monto}`).join(' · ')
                                    : '--'}
                                </span>
                                <span className="col-action" style={{ flex: '0 0 70px' }}>
                                  {c.estado !== 'PAGADO' && (
                                    <button type="button" className="btn-ghost btn-sm" onClick={() => openPagoModal(c)}>Pagar</button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Pago de cuota ──────────────────────── */}
      {pagoModal && (
        <div className="modal-backdrop" onClick={() => setPagoModal(false)} style={{ zIndex: 1001 }}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar pago</h3>
              <button className="icon-button" onClick={() => setPagoModal(false)}>{<X size={16} />}</button>
            </div>
            <div className="modal-body">
              {error && <p className="error-text">{error}</p>}
              <div className="settings-field">
                <label>Monto *</label>
                <input type="number" min="0" step="0.01" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} placeholder="0.00" />
              </div>
              <div className="settings-field">
                <label>Fecha *</label>
                <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
              </div>
              <div className="settings-field">
                <label>¿Dónde ingresó el dinero? *</label>
                <select
                  value={pagoForm.treasuryAccountId}
                  onChange={(e) => setPagoForm({ ...pagoForm, treasuryAccountId: e.target.value })}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <label>Observacion</label>
                <textarea rows={2} value={pagoForm.observacion} onChange={(e) => setPagoForm({ ...pagoForm, observacion: e.target.value })} placeholder="Notas adicionales" />
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setPagoModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handlePagoSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Pago masivo ─────────────────────── */}
      {modalMode === 'pay' && (() => {
        const socio = socios.find((x) => x.id === pagoMasivoSocioId);
        const displayTotal = pagoMasivoInputMode === 'check'
          ? sumChecked()
          : (Number(pagoMasivoTotal) || 0);
        const isValid = displayTotal > 0 && cuotasAdeudadas.some((c) => pagoMasivoChecked[c.id]);

        return (
          <div className="modal-backdrop" onClick={closeModal}>
            <div className="modal user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="modal-header">
                <h3>Registrar pago{socio ? ` — ${socio.apellido}, ${socio.nombre} (Nº ${socio.nroSocio})` : ''}</h3>
                <button className="icon-button" onClick={closeModal}>{<X size={16} />}</button>
              </div>
              <div className="modal-body">
                {pagoMasivoError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{pagoMasivoError}</p>}

                {pagoMasivoLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
                ) : cuotasAdeudadas.length === 0 ? (
                  <p style={{ color: 'var(--color-text-faint)', textAlign: 'center', padding: '1rem' }}>No hay cuotas pendientes.</p>
                ) : (
                  <>
                    <div className="settings-section" style={{ marginBottom: '0.75rem' }}>
                      <div className="sales-table">
                        <div className="sales-table-head">
                          <span className="col-action" style={{ flex: '0 0 36px' }}></span>
                          <span className="col-date" style={{ flex: 1 }}>Periodo</span>
                          <span className="col-total" style={{ flex: '0 0 110px' }}>Saldo pendiente</span>
                          <span className="col-method" style={{ flex: '0 0 80px' }}>Estado</span>
                        </div>
                        {cuotasAdeudadas.map((c) => {
                          const isPartial =
                            pagoMasivoPartialMonth && pagoMasivoPartialMonth.cuotaId === c.id;
                          return (
                            <div
                              key={c.id}
                              className={`sales-table-row${isPartial ? ' row-pending-debt' : ''}`}
                            >
                              <span className="col-action" style={{ flex: '0 0 36px', display: 'flex', alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={!!pagoMasivoChecked[c.id]}
                                  onChange={() => handleToggleCheck(c.id)}
                                />
                              </span>
                              <span className="col-date" style={{ flex: 1 }}>
                                {MONTH_NAMES_FULL[c.mes - 1]} {c.anio}
                              </span>
                              <span className="col-total" style={{ flex: '0 0 110px', fontWeight: 500 }}>
                                {formatCurrency(c.saldo)}
                              </span>
                              <span className="col-method" style={{ flex: '0 0 80px' }}>
                                {cuotaEstadoBadge(c.estado)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {pagoMasivoPartialMonth && (
                      <div className="alerta-deuda-banner" style={{ marginBottom: '0.75rem', background: 'var(--color-warning-bg, #fef3c7)', color: 'var(--color-warning-text, #92400e)', border: '1px solid var(--color-warning, #f59e0b)' }}>
                        El mes {MONTH_NAMES_FULL[pagoMasivoPartialMonth.mes - 1]} {pagoMasivoPartialMonth.anio} quedara con pago parcial de {formatCurrency(pagoMasivoPartialMonth.monto)} sobre {formatCurrency(pagoMasivoPartialMonth.saldo)}
                      </div>
                    )}

                    <div className="settings-field">
                      <label>Total a pagar</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pagoMasivoInputMode === 'check' ? (sumChecked() || '') : pagoMasivoTotal}
                        onChange={(e) => handleTotalChange(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="settings-field">
                      <label>Fecha</label>
                      <input
                        type="date"
                        value={pagoMasivoFecha}
                        onChange={(e) => setPagoMasivoFecha(e.target.value)}
                      />
                    </div>

                    <div className="settings-field">
                      <label>¿Dónde ingresó el dinero? *</label>
                      <select
                        value={pagoMasivoTreasuryId}
                        onChange={(e) => setPagoMasivoTreasuryId(e.target.value)}
                      >
                        <option value="">Seleccionar cuenta...</option>
                        {treasuryAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleConfirmPagoMasivo}
                    disabled={!isValid || pagoMasivoSaving}
                  >
                    {pagoMasivoSaving ? 'Procesando...' : 'Confirmar pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

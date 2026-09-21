import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, MonitorSmartphone, Plus, RefreshCw, Ticket, Trash2, Upload, X } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import {
  useEntradaFixtures,
  useEntradaRivales,
  useEntradaTicketTemplate,
  useEntradaTorneos,
  useEntradasMpPos,
  useEntradasSalesSummary,
  useInvalidateEntradas,
  usePosDevices,
  useTicketSales,
} from '../api/queries';
import type { EntradaFixture, EntradaSaleStatus, MpDetectedStore, PosDeviceCreated } from '../api/types';
import { useToast } from '../components/ToastProvider';
import { useModuleAccess } from '../hooks/useModuleAccess';

type TabId = 'ventas' | 'calendario' | 'abm' | 'diseno' | 'config';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'abm', label: 'ABM' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'config', label: 'Configuración' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

export const AdminEntradasPage: React.FC = () => {
  const access = useModuleAccess('ENTRADAS');
  const canWrite = access === 'FULL';
  const [tab, setTab] = useState<TabId>('ventas');

  return (
    <div className="treasury-page">
      <nav className="treasury-subnav">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? 'treasury-subnav-link active' : 'treasury-subnav-link'}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="treasury-content">
        {tab === 'ventas' && <VentasTab canWrite={canWrite} />}
        {tab === 'calendario' && <CalendarioTab canWrite={canWrite} />}
        {tab === 'abm' && <AbmTab canWrite={canWrite} />}
        {tab === 'diseno' && <DisenoTab canWrite={canWrite} />}
        {tab === 'config' && <ConfigTab canWrite={canWrite} />}
      </div>
    </div>
  );
};

// ── Ventas ───────────────────────────────────────────────────
const VentasTab: React.FC<{ canWrite: boolean }> = () => {
  const [fixtureId, setFixtureId] = useState('');
  const { data: fixtures } = useEntradaFixtures();
  const { data: sales, isLoading } = useTicketSales(fixtureId || undefined);
  const { data: summary } = useEntradasSalesSummary(fixtureId || undefined);

  const options = useMemo(() => (fixtures ?? []).slice(-60), [fixtures]);

  return (
    <div>
      <div className="settings-field" style={{ maxWidth: 420 }}>
        <label>Partido</label>
        <select value={fixtureId} onChange={(e) => setFixtureId(e.target.value)}>
          <option value="">Todos (últimas 500)</option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {fmtFecha(f.fecha)} · {f.torneo.nombre} vs {f.rival.nombre}
            </option>
          ))}
        </select>
      </div>
      {summary && fixtureId && (
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-card"><span className="stat-label">Local</span><span className="stat-value">{summary.local}</span></div>
          <div className="stat-card"><span className="stat-label">Visitante</span><span className="stat-value">{summary.visitante}</span></div>
          <div className="stat-card"><span className="stat-label">Recaudado</span><span className="stat-value">${summary.recaudado}</span></div>
        </div>
      )}
      {isLoading ? <div className="spinner" /> : (
        <table className="sales-table">
          <thead>
            <tr><th>Fecha</th><th>Partido</th><th>Sector</th><th>Cant</th><th>Códigos</th><th>Total</th><th>Estado</th><th>POS</th></tr>
          </thead>
          <tbody>
            {(sales ?? []).map((s) => (
              <tr key={s.id}>
                <td>{fmtDateTime(s.createdAt)}</td>
                <td>{s.fixture.torneo.nombre} vs {s.fixture.rival.nombre}</td>
                <td>{s.sector}</td>
                <td>{s.cantidad}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.units.map((u) => u.codigo).join(', ')}</td>
                <td>${s.total}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{s.device.nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: EntradaSaleStatus }> = ({ status }) => {
  const colors: Record<string, string> = {
    APPROVED: 'var(--color-success)',
    PENDING: 'var(--color-warning)',
    REJECTED: 'var(--color-danger)',
    EXPIRED: 'var(--color-text-faint)',
    CANCELLED: 'var(--color-text-faint)',
  };
  return <span style={{ color: colors[status] ?? undefined, fontWeight: 600 }}>{status}</span>;
};

// ── Calendario ───────────────────────────────────────────────
const CalendarioTab: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateEntradas();
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const from = `${month}-01`;
  const toDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
  const to = `${month}-${String(toDate.getDate()).padStart(2, '0')}`;
  const { data: fixtures, isLoading } = useEntradaFixtures(from, to);
  const { data: torneos } = useEntradaTorneos();
  const { data: rivales } = useEntradaRivales();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: todayISO(), torneoId: '', rivalId: '' });
  const [editing, setEditing] = useState<EntradaFixture | null>(null);
  const [ventana, setVentana] = useState({ desde: '', hasta: '' });

  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  const submitCreate = async () => {
    if (!form.fecha || !form.torneoId || !form.rivalId) {
      pushToast('Completá fecha, torneo y rival', 'error');
      return;
    }
    try {
      await apiClient.post('/entradas/fixtures', form);
      pushToast('Partido agregado (ventana default 06:00 → 05:59+1)', 'success');
      setShowForm(false);
      invalidate();
    } catch (e) { err(e); }
  };

  const openEdit = (f: EntradaFixture) => {
    setEditing(f);
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    setVentana({ desde: toLocal(f.ventanaDesde), hasta: toLocal(f.ventanaHasta) });
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      await apiClient.patch(`/entradas/fixtures/${editing.id}`, {
        ventanaDesde: ventana.desde ? new Date(ventana.desde).toISOString() : undefined,
        ventanaHasta: ventana.hasta ? new Date(ventana.hasta).toISOString() : undefined,
      });
      pushToast('Ventana actualizada', 'success');
      setEditing(null);
      invalidate();
    } catch (e) { err(e); }
  };

  const toggleActive = async (f: EntradaFixture) => {
    try {
      await apiClient.patch(`/entradas/fixtures/${f.id}`, { activo: !f.activo });
      invalidate();
    } catch (e) { err(e); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {canWrite && (
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} /> Partido
          </button>
        )}
      </div>
      {showForm && canWrite && (
        <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
          <div><label>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div><label>Torneo</label>
            <select value={form.torneoId} onChange={(e) => setForm({ ...form, torneoId: e.target.value })}>
              <option value="">Seleccionar</option>
              {(torneos ?? []).filter((t) => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre} (${t.precio})</option>)}
            </select>
          </div>
          <div><label>Rival</label>
            <select value={form.rivalId} onChange={(e) => setForm({ ...form, rivalId: e.target.value })}>
              <option value="">Seleccionar</option>
              {(rivales ?? []).filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={submitCreate}>Guardar</button>
        </div>
      )}
      {isLoading ? <div className="spinner" /> : (
        <table className="sales-table">
          <thead><tr><th>Fecha</th><th>Torneo</th><th>Rival</th><th>Ventana venta</th><th>Activo</th>{canWrite && <th />}</tr></thead>
          <tbody>
            {(fixtures ?? []).map((f) => (
              <tr key={f.id}>
                <td>{fmtFecha(f.fecha)}</td>
                <td>{f.torneo.nombre} (${f.torneo.precio})</td>
                <td>{f.rival.nombre}</td>
                <td>{fmtDateTime(f.ventanaDesde)} → {fmtDateTime(f.ventanaHasta)}</td>
                <td>{f.activo ? 'Sí' : 'No'}</td>
                {canWrite && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(f)}>Ventana</button>{' '}
                    <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(f)}>{f.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <div className="ligas-modal-overlay" onClick={() => setEditing(null)}>
          <div className="ligas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ligas-modal-header"><strong>Ventana de venta</strong>
              <button type="button" className="ligas-modal-close" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className="ligas-modal-body">
              <p>{editing.torneo.nombre} vs {editing.rival.nombre} ({fmtFecha(editing.fecha)})</p>
              <div className="settings-field"><label>Desde</label>
                <input type="datetime-local" value={ventana.desde} onChange={(e) => setVentana({ ...ventana, desde: e.target.value })} />
              </div>
              <div className="settings-field"><label>Hasta</label>
                <input type="datetime-local" value={ventana.hasta} onChange={(e) => setVentana({ ...ventana, hasta: e.target.value })} />
              </div>
              <button type="button" className="btn-primary btn-sm" onClick={submitEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ABM ──────────────────────────────────────────────────────
const AbmTab: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateEntradas();
  const { data: torneos } = useEntradaTorneos();
  const { data: rivales } = useEntradaRivales();
  const [torneoForm, setTorneoForm] = useState({ nombre: '', precio: '' });
  const [rivalForm, setRivalForm] = useState({ nombre: '' });
  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
      <div>
        <h3>Torneos (nombre + precio)</h3>
        {canWrite && (
          <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
            <div><label>Nombre</label><input value={torneoForm.nombre} onChange={(e) => setTorneoForm({ ...torneoForm, nombre: e.target.value })} placeholder="Femenino" /></div>
            <div><label>Precio</label><input value={torneoForm.precio} onChange={(e) => setTorneoForm({ ...torneoForm, precio: e.target.value })} placeholder="1500" inputMode="decimal" /></div>
            <button type="button" className="btn-primary btn-sm" onClick={async () => {
              try {
                await apiClient.post('/entradas/torneos', { nombre: torneoForm.nombre, precio: Number(torneoForm.precio) });
                setTorneoForm({ nombre: '', precio: '' });
                pushToast('Torneo creado', 'success');
                invalidate();
              } catch (e) { err(e); }
            }}><Plus size={14} /></button>
          </div>
        )}
        <table className="sales-table">
          <thead><tr><th>Nombre</th><th>Precio</th><th>Activo</th>{canWrite && <th />}</tr></thead>
          <tbody>
            {(torneos ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.nombre}</td><td>${t.precio}</td><td>{t.activo ? 'Sí' : 'No'}</td>
                {canWrite && (
                  <td><button type="button" className="btn-secondary btn-sm" onClick={async () => {
                    try { await apiClient.patch(`/entradas/torneos/${t.id}`, { activo: !t.activo }); invalidate(); } catch (e) { err(e); }
                  }}>{t.activo ? 'Desactivar' : 'Activar'}</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Rivales (solo nombre)</h3>
        {canWrite && (
          <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
            <div><label>Nombre</label><input value={rivalForm.nombre} onChange={(e) => setRivalForm({ nombre: e.target.value })} placeholder="Mundialito" /></div>
            <button type="button" className="btn-primary btn-sm" onClick={async () => {
              try {
                await apiClient.post('/entradas/rivales', { nombre: rivalForm.nombre });
                setRivalForm({ nombre: '' });
                pushToast('Rival creado', 'success');
                invalidate();
              } catch (e) { err(e); }
            }}><Plus size={14} /></button>
          </div>
        )}
        <table className="sales-table">
          <thead><tr><th>Nombre</th><th>Activo</th>{canWrite && <th />}</tr></thead>
          <tbody>
            {(rivales ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td><td>{r.activo ? 'Sí' : 'No'}</td>
                {canWrite && (
                  <td><button type="button" className="btn-secondary btn-sm" onClick={async () => {
                    try { await apiClient.patch(`/entradas/rivales/${r.id}`, { activo: !r.activo }); invalidate(); } catch (e) { err(e); }
                  }}>{r.activo ? 'Desactivar' : 'Activar'}</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── POS Mercado Pago dedicado ────────────────────────────────
const MpPosSection: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateEntradas();
  const queryClient = useQueryClient();
  const { data: status } = useEntradasMpPos();
  const [stores, setStores] = useState<MpDetectedStore[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ storeName: '', posName: 'Entradas', streetName: '', streetNumber: '', cityName: '', stateName: '', zipCode: '' });
  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');
  const refresh = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['entradas-mp-pos'] });
  };

  const detect = async () => {
    setDetecting(true);
    try {
      const res = await apiClient.get<{ stores: MpDetectedStore[] }>('/entradas/mp-pos/detect-stores');
      setStores(res.data.stores ?? []);
      if ((res.data.stores ?? []).length === 0) pushToast('Sin tiendas/POS en la cuenta MP', 'error');
    } catch (e) { err(e); } finally { setDetecting(false); }
  };

  const select = async (storeId: string, posId: string) => {
    try {
      await apiClient.post('/entradas/mp-pos/select', { storeId, posId });
      pushToast('POS de entradas vinculado', 'success');
      setStores(null);
      refresh();
    } catch (e) { err(e); }
  };

  const create = async () => {
    try {
      await apiClient.post('/entradas/mp-pos/setup', form);
      pushToast('POS de entradas creado en MP', 'success');
      setShowCreate(false);
      refresh();
    } catch (e) { err(e); }
  };

  const disconnect = async () => {
    if (!confirm('¿Desvincular el POS de entradas? El principal no se toca.')) return;
    try {
      await apiClient.post('/entradas/mp-pos/disconnect');
      pushToast('POS de entradas desvinculado', 'success');
      refresh();
    } catch (e) { err(e); }
  };

  return (
    <section>
      <h3>POS Mercado Pago de entradas (dedicado)</h3>
      <p><small>
        {status?.linked
          ? `Vinculado: ${status.storeName ?? ''} / ${status.posName ?? ''} ${status.hasQr ? '· QR OK' : '· sin QR'}`
          : 'No vinculado. El POS principal de la web no se usa ni se modifica.'}
      </small></p>
      {canWrite && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary btn-sm" onClick={detect} disabled={detecting}>
            {detecting ? 'Detectando...' : 'Detectar tiendas/POS'}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus size={14} /> Crear nuevo en MP
          </button>
          {status?.linked && (
            <button type="button" className="btn-secondary btn-sm" onClick={disconnect}>
              <Trash2 size={12} /> Desvincular
            </button>
          )}
        </div>
      )}
      {stores && (
        <table className="sales-table">
          <thead><tr><th>Tienda</th><th>POS</th>{canWrite && <th />}</tr></thead>
          <tbody>
            {stores.flatMap((s) => s.pos.map((p) => (
              <tr key={`${s.id}-${p.id}`}>
                <td>{s.name} ({s.id})</td>
                <td>{p.name} ({p.id})</td>
                {canWrite && (
                  <td><button type="button" className="btn-primary btn-sm" onClick={() => select(s.id, p.id)}>Usar este</button></td>
                )}
              </tr>
            )))}
          </tbody>
        </table>
      )}
      {showCreate && canWrite && (
        <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end', marginTop: '0.75rem' }}>
          {[
            ['storeName', 'Tienda'], ['posName', 'Caja'], ['streetName', 'Calle'],
            ['streetNumber', 'Número'], ['cityName', 'Ciudad'], ['stateName', 'Provincia'], ['zipCode', 'CP'],
          ].map(([key, label]) => (
            <div key={key}><label>{label}</label>
              <input value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn-primary btn-sm" onClick={create}>Crear en MP</button>
        </div>
      )}
    </section>
  );
};

// ── Diseño (editor + preview en vivo) ──────────────────────────
const PREVIEW_SAMPLE: Record<string, string> = {
  club: 'Club Atlético Soler',
  torneo: 'Femenino',
  rival: 'Mundialito',
  fecha: '25/09 21:00',
  sector: 'LOCAL',
  codigo: 'L-013',
  codigos: 'L-013',
  precioUnit: '1500.00',
  cantidad: '1',
  total: '1500.00',
  descuento: '0',
  subtotal: '1500.00',
  ventaId: 'abc-123',
  fechaPago: '25/09 20:58',
  footer: 'Ticket no fiscal',
  escudo: '',
};

const substituteVars = (value: string) =>
  value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => PREVIEW_SAMPLE[key] ?? `{{${key}}}`);

const PREVIEW_FONT_SIZE: Record<string, number> = { S: 11, M: 14, L: 18, XL: 26 };

const TicketPreview: React.FC<{ elements: Array<Record<string, unknown>>; escudoBase64: string | null }> = ({ elements, escudoBase64 }) => (
  <div style={{ background: '#fff', color: '#000', width: 300, padding: '12px 10px', fontFamily: 'monospace, monospace', borderRadius: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
    {elements.filter((el) => el.enabled !== false).map((el, i) => {
      const type = String(el.type ?? '');
      const align = (['left', 'center', 'right'] as const).includes(el.align as never) ? String(el.align) : 'center';
      if (type === 'line') return <hr key={i} style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />;
      if (type === 'spacer') return <div key={i} style={{ height: 10 }} />;
      if (type === 'logo') {
        return (
          <div key={i} style={{ textAlign: align as never, margin: '4px 0' }}>
            {escudoBase64 ? (
              <img src={`data:image/png;base64,${escudoBase64}`} alt="Escudo" style={{ width: 120, imageRendering: 'pixelated' }} />
            ) : (
              <div style={{ border: '1px dashed #888', color: '#888', fontSize: 11, padding: 10 }}>ESCUDO (sin imagen)</div>
            )}
          </div>
        );
      }
      if (type === 'qr') {
        const value = substituteVars(String(el.value ?? ''));
        return (
          <div key={i} style={{ textAlign: align as never, margin: '6px 0' }}>
            <div style={{ display: 'inline-block', border: '2px solid #000', padding: 6, fontSize: 10, lineHeight: 1.4 }}>
              ▓▓░▓<br />░▓▓░<br />▓░▓▓
              <div style={{ marginTop: 4 }}>{value || 'QR'}</div>
            </div>
          </div>
        );
      }
      const size = PREVIEW_FONT_SIZE[String(el.size ?? 'M')] ?? 14;
      return (
        <div key={i} style={{ textAlign: align as never, fontSize: size, fontWeight: el.bold ? 'bold' : 'normal', margin: '2px 0', wordBreak: 'break-word' }}>
          {substituteVars(String(el.value ?? ''))}
        </div>
      );
    })}
  </div>
);

const DisenoTab: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateEntradas();
  const queryClient = useQueryClient();
  const { data: template } = useEntradaTicketTemplate();
  const [elements, setElements] = useState<Array<Record<string, unknown>> | null>(null);
  const [escudoWidth, setEscudoWidth] = useState('256');
  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  const currentElements = elements ?? (template?.layout.elements as Array<Record<string, unknown>> | undefined) ?? [];

  const { data: escudoFull } = useQuery({
    queryKey: ['entradas-escudo-full'],
    queryFn: async () => {
      const res = await apiClient.get<{ version: number; widthPx: number; pngBase64: string | null }>('/entradas/ticket-assets/escudo');
      return res.data;
    },
  });

  const saveTemplate = async () => {
    try {
      await apiClient.patch('/entradas/ticket-template', { widthCols: 32, elements: currentElements });
      pushToast('Diseño guardado', 'success');
      setElements(null);
      invalidate();
    } catch (e) { err(e); }
  };

  const moveEl = (i: number, dir: -1 | 1) => {
    const next = [...currentElements];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setElements(next);
  };

  const uploadEscudo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('widthPx', escudoWidth);
      await apiClient.post('/entradas/ticket-assets/escudo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      pushToast('Escudo actualizado', 'success');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['entradas-escudo-full'] });
      queryClient.invalidateQueries({ queryKey: ['entradas-escudo'] });
    } catch (e) { err(e); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <section>
          <h3><Ticket size={16} /> Diseño del ticket (32 columnas)</h3>
          <p><small>Variables: {'{{club}} {{torneo}} {{rival}} {{fecha}} {{sector}} {{codigo}} {{codigos}} {{precioUnit}} {{cantidad}} {{total}} {{descuento}} {{subtotal}} {{ventaId}} {{fechaPago}} {{footer}} {{escudo}}'}</small></p>
          {currentElements.map((el, i) => (
            <div key={i} className="settings-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <strong style={{ minWidth: 60 }}>{String(el.type ?? '?')}</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={el.enabled !== false} disabled={!canWrite}
                  onChange={(e) => { const n = [...currentElements]; n[i] = { ...n[i], enabled: e.target.checked }; setElements(n); }} /> on
              </label>
              {typeof el.value === 'string' && (
                <div style={{ flex: 1, minWidth: 200 }}><label>Texto</label>
                  <input value={el.value} disabled={!canWrite}
                    onChange={(e) => { const n = [...currentElements]; n[i] = { ...n[i], value: e.target.value }; setElements(n); }} />
                </div>
              )}
              {el.type === 'text' && (
                <>
                  <div><label>Tamaño</label>
                    <select value={String(el.size ?? 'M')} disabled={!canWrite}
                      onChange={(e) => { const n = [...currentElements]; n[i] = { ...n[i], size: e.target.value }; setElements(n); }}>
                      {['S', 'M', 'L', 'XL'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label>Alineación</label>
                    <select value={String(el.align ?? 'center')} disabled={!canWrite}
                      onChange={(e) => { const n = [...currentElements]; n[i] = { ...n[i], align: e.target.value }; setElements(n); }}>
                      {['left', 'center', 'right'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={el.bold === true} disabled={!canWrite}
                      onChange={(e) => { const n = [...currentElements]; n[i] = { ...n[i], bold: e.target.checked }; setElements(n); }} /> Negrita
                  </label>
                </>
              )}
              {canWrite && (
                <>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => moveEl(i, -1)}><ArrowUp size={12} /></button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => moveEl(i, 1)}><ArrowDown size={12} /></button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setElements(currentElements.filter((_, j) => j !== i))}><X size={12} /></button>
                </>
              )}
            </div>
          ))}
          {canWrite && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-primary btn-sm" onClick={saveTemplate}>Guardar diseño (v{(template?.version ?? 1) + (elements ? 1 : 0)})</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setElements(null)}>Descartar cambios</button>
            </div>
          )}
        </section>

        <section>
          <h3><Upload size={16} /> Escudo del club (monocromático)</h3>
          <p><small>Versión actual: v{escudoFull?.version ?? 1} · {escudoFull?.pngBase64 ? `imagen cargada (${escudoFull.widthPx}px)` : 'sin imagen'} · El POS la descarga una sola vez.</small></p>
          {canWrite && (
            <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <div><label>Ancho (px)</label>
                <select value={escudoWidth} onChange={(e) => setEscudoWidth(e.target.value)}>
                  <option value="256">256 (58mm)</option>
                  <option value="384">384 (80mm)</option>
                </select>
              </div>
              <div><label>PNG (se convierte a 1-bit)</label>
                <input type="file" accept="image/png,image/jpeg" onChange={(e) => uploadEscudo(e.target.files?.[0])} />
              </div>
            </div>
          )}
        </section>
      </div>

      <div style={{ position: 'sticky', top: 12 }}>
        <h3>Vista previa</h3>
        <p><small>Datos de ejemplo · aprox. 32 columnas{elements ? ' · con cambios sin guardar' : ''}</small></p>
        <TicketPreview elements={currentElements} escudoBase64={escudoFull?.pngBase64 ?? null} />
      </div>
    </div>
  );
};

// ── Configuración ────────────────────────────────────────────
const ConfigTab: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const { pushToast } = useToast();
  const invalidate = useInvalidateEntradas();
  const { data: devices } = usePosDevices();
  const [deviceName, setDeviceName] = useState('');
  const [newToken, setNewToken] = useState<PosDeviceCreated | null>(null);
  const err = (e: unknown) => pushToast(normalizeApiError(e), 'error');

  const createDevice = async () => {
    if (!deviceName.trim()) { pushToast('Nombre del dispositivo requerido', 'error'); return; }
    try {
      const baseUrl = `${window.location.origin}/api`;
      const res = await apiClient.post<PosDeviceCreated>('/entradas/devices', { nombre: deviceName.trim(), baseUrl });
      setNewToken(res.data);
      setDeviceName('');
      invalidate();
    } catch (e) { err(e); }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <MpPosSection canWrite={canWrite} />
      <section>
        <h3><MonitorSmartphone size={16} /> Dispositivos POS</h3>
        {canWrite && (
          <div className="settings-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', maxWidth: 420 }}>
            <div><label>Nombre</label><input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="POS puerta 1" /></div>
            <button type="button" className="btn-primary btn-sm" onClick={createDevice}><Plus size={14} /> Generar</button>
          </div>
        )}
        {newToken && (
          <div className="settings-field" style={{ background: 'var(--color-surface-alt)', padding: '0.75rem', borderRadius: 8 }}>
            <strong>Token (se muestra una sola vez):</strong>
            <code style={{ display: 'block', wordBreak: 'break-all', margin: '0.5rem 0' }}>{newToken.token}</code>
            <small>Pairing: <code style={{ wordBreak: 'break-all' }}>{JSON.stringify(newToken.pairing)}</code></small>
          </div>
        )}
        <table className="sales-table">
          <thead><tr><th>Nombre</th><th>Activo</th><th>Última conexión</th>{canWrite && <th />}</tr></thead>
          <tbody>
            {(devices ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.nombre}</td><td>{d.activo ? 'Sí' : 'No'}</td><td>{fmtDateTime(d.lastSeenAt)}</td>
                {canWrite && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-secondary btn-sm" onClick={async () => {
                      try {
                        const baseUrl = `${window.location.origin}/api`;
                        const res = await apiClient.post<PosDeviceCreated>(`/entradas/devices/${d.id}/rotate`, { baseUrl });
                        setNewToken(res.data);
                        invalidate();
                      } catch (e) { err(e); }
                    }}><RefreshCw size={12} /> Rotar</button>{' '}
                    <button type="button" className="btn-secondary btn-sm" onClick={async () => {
                      if (!confirm(`Revocar ${d.nombre}?`)) return;
                      try { await apiClient.post(`/entradas/devices/${d.id}/revoke`); invalidate(); } catch (e) { err(e); }
                    }}><Trash2 size={12} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

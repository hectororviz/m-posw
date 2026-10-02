import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useMoneyAccounts, useMoneyCategories, useResponsables, useMpAuditoriaStatus, useSettings } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';

type Entity = 'accounts' | 'categories' | 'responsables';
type ModalMode = 'view' | 'edit' | 'new';

interface ModalState {
  entity: Entity;
  mode: ModalMode;
  id?: string;
}

type Account = { id: string; name: string; kind: string; initialBalance: number | string; active: boolean };
type Category = { id: string; name: string; kind: string; grupo?: string; active: boolean };
type Responsable = { id: string; nombre: string; active: boolean };

export const FinanzasCuentasPage: React.FC = () => {
  const access = useModuleAccess('TESORERIA');
  const canWrite = access === 'FULL';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: accounts = [], isLoading: loadingA } = useMoneyAccounts();
  const { data: categories = [], isLoading: loadingC } = useMoneyCategories();
  const { data: responsables = [] } = useResponsables();
  const { data: mpStatus } = useMpAuditoriaStatus();
  const { data: settings } = useSettings();

  const [modal, setModal] = useState<ModalState | null>(null);

  // Campos cuenta
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState('OTRO');
  const [accountBalance, setAccountBalance] = useState('');
  // Campos categoría
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState('AMBOS');
  const [categoryGrupo, setCategoryGrupo] = useState('OPERATIVO');
  // Campos responsable
  const [responsableName, setResponsableName] = useState('');

  const [mpSince, setMpSince] = useState('');
  const [mpBusy, setMpBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['finanzas-accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['finanzas-categories'] });
    await queryClient.invalidateQueries({ queryKey: ['finanzas-responsables'] });
    await queryClient.invalidateQueries({ queryKey: ['mp-auditoria-status'] });
  };

  const readOnly = modal?.mode === 'view';

  // ─── Abrir modal ──
  const openViewAccount = (a: Account) => {
    setAccountName(a.name);
    setAccountKind(a.kind);
    setAccountBalance(String(a.initialBalance ?? ''));
    setModal({ entity: 'accounts', mode: 'view', id: a.id });
  };
  const openNewAccount = () => {
    setAccountName('');
    setAccountKind('OTRO');
    setAccountBalance('');
    setModal({ entity: 'accounts', mode: 'new' });
  };
  const openViewCategory = (c: Category) => {
    setCategoryName(c.name);
    setCategoryKind(c.kind);
    setCategoryGrupo(c.grupo ?? 'OPERATIVO');
    setModal({ entity: 'categories', mode: 'view', id: c.id });
  };
  const openNewCategory = () => {
    setCategoryName('');
    setCategoryKind('AMBOS');
    setCategoryGrupo('OPERATIVO');
    setModal({ entity: 'categories', mode: 'new' });
  };
  const openViewResponsable = (r: Responsable) => {
    setResponsableName(r.nombre);
    setModal({ entity: 'responsables', mode: 'view', id: r.id });
  };
  const openNewResponsable = () => {
    setResponsableName('');
    setModal({ entity: 'responsables', mode: 'new' });
  };

  // ─── Guardar ──
  const saveAccount = async () => {
    if (!accountName.trim()) {
      pushToast('Ingresá el nombre de la cuenta', 'error');
      return;
    }
    setSaving(true);
    try {
      const balance = accountBalance === '' ? undefined : Number(String(accountBalance).replace(',', '.'));
      const payload = {
        name: accountName.trim(),
        kind: accountKind,
        ...(balance !== undefined && !Number.isNaN(balance) ? { initialBalance: balance } : {}),
      };
      if (modal?.mode === 'edit') {
        await apiClient.patch(`/finanzas/accounts/${modal.id}`, payload);
      } else {
        await apiClient.post('/finanzas/accounts', payload);
      }
      pushToast('Cuenta guardada', 'success');
      setModal(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (id: string, active: boolean) => {
    if (!canWrite) return;
    try {
      await apiClient.patch(`/finanzas/accounts/${id}`, { active: !active });
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      pushToast('Ingresá el nombre de la categoría', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: categoryName.trim(), kind: categoryKind, grupo: categoryGrupo };
      if (modal?.mode === 'edit') {
        await apiClient.patch(`/finanzas/categories/${modal.id}`, payload);
      } else {
        await apiClient.post('/finanzas/categories', payload);
      }
      pushToast('Categoría guardada', 'success');
      setModal(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (id: string, active: boolean) => {
    if (!canWrite) return;
    try {
      await apiClient.patch(`/finanzas/categories/${id}`, { active: !active });
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const saveResponsable = async () => {
    if (!responsableName.trim()) {
      pushToast('Ingresá el nombre', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/finanzas/responsables', { nombre: responsableName.trim() });
      pushToast('Responsable guardado', 'success');
      setModal(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleResponsable = async (id: string) => {
    if (!canWrite) return;
    try {
      await apiClient.patch(`/finanzas/responsables/${id}/toggle`, {});
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

  const saveMpSince = async () => {
    if (!mpSince) {
      pushToast('Elegí la fecha de corte', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch('/settings', { mpAuditSince: new Date(`${mpSince}T03:00:00.000Z`).toISOString() });
      pushToast('Fecha de corte guardada', 'success');
      setMpSince('');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const runBackfill = async () => {
    setMpBusy(true);
    try {
      const since = (settings as { mpAuditSince?: string | null } | undefined)?.mpAuditSince ?? '2026-10-01T03:00:00.000Z';
      const res = await apiClient.post('/mp-auditoria/backfill', { from: since });
      pushToast(`Histórico traído: ${res.data.nuevos} movimientos`, 'success');
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpBusy(false);
    }
  };

  const runBackfillVentas = async () => {
    setMpBusy(true);
    try {
      const since = (settings as { mpAuditSince?: string | null } | undefined)?.mpAuditSince ?? '2026-10-01T03:00:00.000Z';
      const res = await apiClient.post('/finanzas/backfill-ventas', { since });
      pushToast(`Ventas evaluadas: ${res.data.evaluadas}, entradas: ${res.data.entradasVenta}`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['finanzas-summary'] });
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpBusy(false);
    }
  };

  const refreshBalance = async () => {
    setMpBusy(true);
    try {
      await apiClient.get('/mp-auditoria/balance');
      pushToast('Saldo actualizado', 'success');
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setMpBusy(false);
    }
  };

  const modalTitle = (() => {
    if (!modal) return '';
    const names: Record<Entity, { s: string; nuevo: string }> = {
      accounts: { s: 'Cuenta', nuevo: 'nueva' },
      categories: { s: 'Categoría', nuevo: 'nueva' },
      responsables: { s: 'Responsable', nuevo: 'nuevo' },
    };
    const n = names[modal.entity];
    return modal.mode === 'new' ? `${n.s} ${n.nuevo}` : n.s;
  })();

  const isReadOnlyEntity = modal?.entity === 'responsables';

  return (
    <div className="finanzas-page">
      <div className="page-header">
        <div>
          <h2>Configuración</h2>
          <p className="page-subtitle">Cuentas, categorías, responsables y Mercado Pago</p>
        </div>
      </div>

      {(loadingA || loadingC) && <p className="loading-text">Cargando...</p>}

      <div className="finanzas-config-grid">
        {/* Cuentas */}
        <div className="section">
          <h3>Cuentas (de dónde sale / entra el dinero)</h3>
          <div className="finanzas-simple-list">
            {accounts.map((a) => (
              <div key={a.id} className={`finanzas-simple-row${a.active ? '' : ' inactive'}`} onClick={() => openViewAccount(a)} style={{ cursor: 'pointer' }}>
                <span><strong>{a.name}</strong> <small>· {a.kind} · inicial ${Number(a.initialBalance).toLocaleString('es-AR')}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost" title="Editar" onClick={() => openViewAccount(a)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => toggleAccount(a.id, a.active)}>
                      {a.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canWrite && (
            <div className="finanzas-inline-form">
              <button className="btn-primary" onClick={openNewAccount}><Plus size={14} style={{ verticalAlign: -2 }} /> Agregar cuenta</button>
            </div>
          )}
        </div>

        {/* Categorías */}
        <div className="section">
          <h3>Categorías (en qué se gasta / de qué se ingresa)</h3>
          <div className="finanzas-simple-list">
            {categories.map((c) => (
              <div key={c.id} className={`finanzas-simple-row${c.active ? '' : ' inactive'}`} onClick={() => openViewCategory(c)} style={{ cursor: 'pointer' }}>
                <span><strong>{c.name}</strong> <small>· {c.kind === 'AMBOS' ? 'ambos' : c.kind.toLowerCase()} · {(c.grupo ?? 'OPERATIVO').toLowerCase()}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost" title="Editar" onClick={() => openViewCategory(c)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => toggleCategory(c.id, c.active)}>
                      {c.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canWrite && (
            <div className="finanzas-inline-form">
              <button className="btn-primary" onClick={openNewCategory}><Plus size={14} style={{ verticalAlign: -2 }} /> Agregar categoría</button>
            </div>
          )}
        </div>

        {/* Responsables */}
        <div className="section">
          <h3>Responsables</h3>
          <div className="finanzas-simple-list">
            {responsables.map((r) => (
              <div key={r.id} className={`finanzas-simple-row${r.active ? '' : ' inactive'}`} onClick={() => openViewResponsable(r)} style={{ cursor: 'pointer' }}>
                <span><strong>{r.nombre}</strong></span>
                {canWrite && (
                  <span className="finanzas-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost" title="Editar" onClick={() => openViewResponsable(r)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => toggleResponsable(r.id)}>
                      {r.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canWrite && (
            <div className="finanzas-inline-form">
              <button className="btn-primary" onClick={openNewResponsable}><Plus size={14} style={{ verticalAlign: -2 }} /> Agregar responsable</button>
            </div>
          )}
        </div>

        {/* Mercado Pago */}
        <div className="section">
          <h3>Mercado Pago</h3>
          <p className="page-subtitle">
            Corte: {(settings as { mpAuditSince?: string | null } | undefined)?.mpAuditSince
              ? new Date((settings as { mpAuditSince: string }).mpAuditSince).toLocaleDateString('es-AR')
              : '01/09/2026'}
            {' · '}pendientes: {mpStatus?.pendientes ?? '—'}
            {mpStatus?.balance != null ? ` · saldo vivo $${Number(mpStatus.balance).toLocaleString('es-AR')}` : ''}
            {mpStatus?.disponible != null
              ? ` · disponible $${Number(mpStatus.disponible).toLocaleString('es-AR')}${mpStatus?.disponibleAt ? ` (${new Date(mpStatus.disponibleAt).toLocaleDateString('es-AR')})` : ''}`
              : ''}
          </p>
          {canWrite && (
            <div className="finanzas-inline-form">
              <input type="date" value={mpSince} onChange={(e) => setMpSince(e.target.value)} />
              <button className="btn-ghost" disabled={saving} onClick={saveMpSince}>Guardar corte</button>
              <button className="btn-ghost" disabled={mpBusy || mpStatus?.running} onClick={runBackfill}>
                {mpBusy ? 'Trayendo...' : 'Traer histórico'}
              </button>
              <button className="btn-ghost" disabled={mpBusy} onClick={runBackfillVentas}>Generar entradas de ventas</button>
              <button className="btn-ghost" disabled={mpBusy} onClick={refreshBalance}>Actualizar saldo</button>
            </div>
          )}
          {mpStatus?.job && (
            <p className="page-subtitle">Último job: {mpStatus.job.status}{mpStatus.job.detail ? ` · ${mpStatus.job.detail}` : ''}</p>
          )}
        </div>
      </div>

      {/* Modal único ver/editar */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card finanzas-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modalTitle}</h3>

            {modal.entity === 'accounts' && (
              <>
                <div className="settings-field">
                  <label>Nombre</label>
                  <input type="text" value={accountName} disabled={readOnly} onChange={(e) => setAccountName(e.target.value)} maxLength={60} />
                </div>
                <div className="settings-field">
                  <label>Tipo</label>
                  <select value={accountKind} disabled={readOnly} onChange={(e) => setAccountKind(e.target.value)}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADOPAGO">Mercado Pago</option>
                    <option value="BANCO">Banco</option>
                    <option value="OTRO">Otra</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Saldo inicial</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={accountBalance}
                    disabled={readOnly}
                    onChange={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setAccountBalance(v);
                    }}
                  />
                </div>
              </>
            )}

            {modal.entity === 'categories' && (
              <>
                <div className="settings-field">
                  <label>Nombre</label>
                  <input type="text" value={categoryName} disabled={readOnly} onChange={(e) => setCategoryName(e.target.value)} maxLength={60} />
                </div>
                <div className="settings-field">
                  <label>Tipo</label>
                  <select value={categoryKind} disabled={readOnly} onChange={(e) => setCategoryKind(e.target.value)}>
                    <option value="AMBOS">Ambos</option>
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Grupo</label>
                  <select value={categoryGrupo} disabled={readOnly} onChange={(e) => setCategoryGrupo(e.target.value)}>
                    <option value="OPERATIVO">Operativo</option>
                    <option value="FINANCIERO">Financiero</option>
                  </select>
                </div>
              </>
            )}

            {modal.entity === 'responsables' && (
              <div className="settings-field">
                <label>Nombre</label>
                <input type="text" value={responsableName} disabled={readOnly} onChange={(e) => setResponsableName(e.target.value)} maxLength={60} />
              </div>
            )}

            <div className="modal-actions">
              {readOnly && canWrite && !isReadOnlyEntity && (
                <button className="btn-ghost" onClick={() => setModal({ ...modal, mode: modal.id ? 'edit' : 'new' })}>Editar</button>
              )}
              <button className="btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
              {!readOnly && canWrite && (
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={modal.entity === 'accounts' ? saveAccount : modal.entity === 'categories' ? saveCategory : saveResponsable}
                >
                  Guardar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
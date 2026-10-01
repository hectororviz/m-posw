import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useMoneyAccounts, useMoneyCategories, useResponsables, useMpAuditoriaStatus, useSettings } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';

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

  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState('OTRO');
  const [accountBalance, setAccountBalance] = useState('');
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState('AMBOS');
  const [categoryGrupo, setCategoryGrupo] = useState('OPERATIVO');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
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

  const saveAccount = async () => {
    if (!accountName.trim()) {
      pushToast('Ingresá el nombre de la cuenta', 'error');
      return;
    }
    setSaving(true);
    try {
      const balance = accountBalance === '' ? undefined : Number(String(accountBalance).replace(',', '.'));
      if (editingAccount) {
        await apiClient.patch(`/finanzas/accounts/${editingAccount}`, {
          name: accountName.trim(),
          kind: accountKind,
          ...(balance !== undefined && !Number.isNaN(balance) ? { initialBalance: balance } : {}),
        });
      } else {
        await apiClient.post('/finanzas/accounts', {
          name: accountName.trim(),
          kind: accountKind,
          ...(balance !== undefined && !Number.isNaN(balance) ? { initialBalance: balance } : {}),
        });
      }
      pushToast('Cuenta guardada', 'success');
      setAccountName('');
      setAccountBalance('');
      setEditingAccount(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (id: string, active: boolean) => {
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
      if (editingCategory) {
        await apiClient.patch(`/finanzas/categories/${editingCategory}`, {
          name: categoryName.trim(),
          kind: categoryKind,
          grupo: categoryGrupo,
        });
      } else {
        await apiClient.post('/finanzas/categories', { name: categoryName.trim(), kind: categoryKind, grupo: categoryGrupo });
      }
      pushToast('Categoría guardada', 'success');
      setCategoryName('');
      setEditingCategory(null);
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
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
      setResponsableName('');
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleResponsable = async (id: string) => {
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

  const toggleCategory = async (id: string, active: boolean) => {
    try {
      await apiClient.patch(`/finanzas/categories/${id}`, { active: !active });
      await refresh();
    } catch (err) {
      pushToast(normalizeApiError(err), 'error');
    }
  };

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
        <div className="section">
          <h3>Cuentas (de dónde sale / entra el dinero)</h3>
          <div className="finanzas-simple-list">
            {accounts.map((a) => (
              <div key={a.id} className={`finanzas-simple-row${a.active ? '' : ' inactive'}`}>
                <span><strong>{a.name}</strong> <small>· {a.kind} · inicial ${Number(a.initialBalance).toLocaleString('es-AR')}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions">
                    <button className="btn-ghost" title="Editar" onClick={() => { setEditingAccount(a.id); setAccountName(a.name); setAccountKind(a.kind); setAccountBalance(String(a.initialBalance)); }}>
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
              <input
                type="text"
                placeholder="Nueva cuenta (ej: Banco Galicia)..."
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                maxLength={60}
              />
              <select value={accountKind} onChange={(e) => setAccountKind(e.target.value)}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="MERCADOPAGO">Mercado Pago</option>
                <option value="BANCO">Banco</option>
                <option value="OTRO">Otra</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Saldo inicial"
                value={accountBalance}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAccountBalance(v);
                }}
                style={{ maxWidth: 130 }}
              />
              <button className="btn-primary" disabled={saving} onClick={saveAccount}>
                {editingAccount ? 'Guardar' : 'Agregar'}
              </button>
              {editingAccount && (
                <button className="btn-ghost" onClick={() => { setEditingAccount(null); setAccountName(''); setAccountBalance(''); }}>
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Categorías (en qué se gasta / de qué se ingresa)</h3>
          <div className="finanzas-simple-list">
            {categories.map((c) => (
              <div key={c.id} className={`finanzas-simple-row${c.active ? '' : ' inactive'}`}>
                <span><strong>{c.name}</strong> <small>· {c.kind === 'AMBOS' ? 'ambos' : c.kind.toLowerCase()} · {(c.grupo ?? 'OPERATIVO').toLowerCase()}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions">
                    <button className="btn-ghost" title="Editar" onClick={() => { setEditingCategory(c.id); setCategoryName(c.name); setCategoryKind(c.kind); setCategoryGrupo(c.grupo ?? 'OPERATIVO'); }}>
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
              <input
                type="text"
                placeholder="Nueva categoría (ej: Panadería)..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                maxLength={60}
              />
              <select value={categoryKind} onChange={(e) => setCategoryKind(e.target.value)}>
                <option value="AMBOS">Ambos</option>
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
              </select>
              <select value={categoryGrupo} onChange={(e) => setCategoryGrupo(e.target.value)}>
                <option value="OPERATIVO">Operativo</option>
                <option value="FINANCIERO">Financiero</option>
              </select>
              <button className="btn-primary" disabled={saving} onClick={saveCategory}>
                {editingCategory ? 'Guardar' : 'Agregar'}
              </button>
              {editingCategory && (
                <button className="btn-ghost" onClick={() => { setEditingCategory(null); setCategoryName(''); }}>
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Responsables</h3>
          <div className="finanzas-simple-list">
            {responsables.map((r) => (
              <div key={r.id} className={`finanzas-simple-row${r.active ? '' : ' inactive'}`}>
                <span><strong>{r.nombre}</strong></span>
                {canWrite && (
                  <span className="finanzas-row-actions">
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
              <input
                type="text"
                placeholder="Nuevo responsable..."
                value={responsableName}
                onChange={(e) => setResponsableName(e.target.value)}
                maxLength={60}
              />
              <button className="btn-primary" disabled={saving} onClick={saveResponsable}>
                Agregar
              </button>
            </div>
          )}
        </div>

        <div className="section">
          <h3>Mercado Pago</h3>
          <p className="page-subtitle">
            Corte: {(settings as { mpAuditSince?: string | null } | undefined)?.mpAuditSince
              ? new Date((settings as { mpAuditSince: string }).mpAuditSince).toLocaleDateString('es-AR')
              : '01/09/2026'}
            {' · '}pendientes: {mpStatus?.pendientes ?? '—'}
            {mpStatus?.balance != null ? ` · saldo vivo $${Number(mpStatus.balance).toLocaleString('es-AR')}` : ''}
          </p>
          {canWrite && (
            <div className="finanzas-inline-form">
              <input type="date" value={mpSince} onChange={(e) => setMpSince(e.target.value)} />
              <button className="btn-ghost" disabled={saving} onClick={saveMpSince}>
                Guardar corte
              </button>
              <button className="btn-ghost" disabled={mpBusy || mpStatus?.running} onClick={runBackfill}>
                {mpBusy ? 'Trayendo...' : 'Traer histórico'}
              </button>
              <button className="btn-ghost" disabled={mpBusy} onClick={runBackfillVentas}>
                Generar entradas de ventas
              </button>
              <button className="btn-ghost" disabled={mpBusy} onClick={refreshBalance}>
                Actualizar saldo
              </button>
            </div>
          )}
          {mpStatus?.job && (
            <p className="page-subtitle">Último job: {mpStatus.job.status}{mpStatus.job.detail ? ` · ${mpStatus.job.detail}` : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
};

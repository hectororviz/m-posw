import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { normalizeApiError } from '../api/client';
import { useLedgerAccounts } from '../api/queries';
import type { LedgerAccountType } from '../api/types';

const typeLabel: Record<LedgerAccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio Neto',
  REVENUE: 'Ingresos',
  EXPENSE: 'Gastos',
};

const typeColor: Record<LedgerAccountType, string> = {
  ASSET: 'badge badge-info',
  LIABILITY: 'badge badge-warning',
  EQUITY: 'badge badge-accent',
  REVENUE: 'badge badge-success',
  EXPENSE: 'badge badge-danger',
};

export const TreasuryLedgerAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useLedgerAccounts();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', type: 'ASSET' as LedgerAccountType, parentId: '', acceptsEntries: true });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['treasury-ledger-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-ledger-accounts-tree'] });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.post('/treasury/accounts', {
        code: createForm.code,
        name: createForm.name,
        type: createForm.type,
        parentId: createForm.parentId || undefined,
        acceptsEntries: createForm.acceptsEntries,
      });
      invalidate();
      setShowCreate(false);
      setCreateForm({ code: '', name: '', type: 'ASSET', parentId: '', acceptsEntries: true });
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await apiClient.patch(`/treasury/accounts/${id}/toggle-active`);
      invalidate();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const parentAccounts = (accounts || []).filter((a) => !a.acceptsEntries);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Plan de Cuentas</h2>
          <p className="page-subtitle">Gestión de cuentas contables</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>＋ Nueva cuenta</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {isLoading && <p className="loading-text">Cargando...</p>}

      {accounts && accounts.length === 0 && <p className="empty-text">No hay cuentas registradas.</p>}

      {accounts && accounts.length > 0 && (
        <div className="treasury-table-wrapper">
          <div className="treasury-table">
            <div className="treasury-table-head">
              <span>Código</span>
              <span>Nombre</span>
              <span>Tipo</span>
              <span>Movimientos</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>
            {accounts.map((a) => (
              <div
                key={a.id}
                className={`treasury-table-row ${!a.acceptsEntries ? 'group-account' : ''} ${!a.active ? 'inactive-row' : ''}`}
              >
                <span>{a.code}</span>
                <span className={!a.acceptsEntries ? 'font-semibold' : 'pl-indent'}>{a.name}</span>
                <span><span className={typeColor[a.type]}>{typeLabel[a.type]}</span></span>
                <span>{a.acceptsEntries ? (a._count?.lines || 0) : '-'}</span>
                <span>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={a.active} onChange={() => handleToggleActive(a.id)} />
                    <span className="toggle-switch-track" />
                  </label>
                </span>
                <span>
                  {a.acceptsEntries ? 'Imputable' : 'Agrupadora'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)} role="presentation">
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva cuenta</h3>
              <button type="button" className="icon-button" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="settings-field">
                  <label>Código</label>
                  <input type="text" value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} required placeholder="Ej: 1.1.04" />
                </div>
                <div className="settings-field">
                  <label>Nombre</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                </div>
                <div className="settings-field">
                  <label>Tipo</label>
                  <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as LedgerAccountType })}>
                    <option value="ASSET">Activo</option>
                    <option value="LIABILITY">Pasivo</option>
                    <option value="EQUITY">Patrimonio Neto</option>
                    <option value="REVENUE">Ingresos</option>
                    <option value="EXPENSE">Gastos</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Cuenta padre</label>
                  <select value={createForm.parentId} onChange={(e) => setCreateForm({ ...createForm, parentId: e.target.value })}>
                    <option value="">Ninguna (raíz)</option>
                    {parentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={createForm.acceptsEntries} onChange={(e) => setCreateForm({ ...createForm, acceptsEntries: e.target.checked })} />
                  <span className="toggle-switch-track" />
                  Acepta movimientos (cuenta imputable)
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

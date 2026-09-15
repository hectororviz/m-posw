import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { apiClient, normalizeApiError } from '../api/client';
import { useMoneyAccounts, useMoneyCategories } from '../api/queries';
import { useModuleAccess } from '../hooks/useModuleAccess';
import { useToast } from '../components/ToastProvider';

export const FinanzasCuentasPage: React.FC = () => {
  const access = useModuleAccess('TESORERIA');
  const canWrite = access === 'FULL';
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: accounts = [], isLoading: loadingA } = useMoneyAccounts();
  const { data: categories = [], isLoading: loadingC } = useMoneyCategories();

  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState('OTRO');
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState('AMBOS');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['finanzas-accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['finanzas-categories'] });
  };

  const saveAccount = async () => {
    if (!accountName.trim()) {
      pushToast('Ingresá el nombre de la cuenta', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingAccount) {
        await apiClient.patch(`/finanzas/accounts/${editingAccount}`, {
          name: accountName.trim(),
          kind: accountKind,
        });
      } else {
        await apiClient.post('/finanzas/accounts', { name: accountName.trim(), kind: accountKind });
      }
      pushToast('Cuenta guardada', 'success');
      setAccountName('');
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
        });
      } else {
        await apiClient.post('/finanzas/categories', { name: categoryName.trim(), kind: categoryKind });
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
          <h2>Cuentas y categorías</h2>
          <p className="page-subtitle">Plan de cuentas personalizable</p>
        </div>
      </div>

      {(loadingA || loadingC) && <p className="loading-text">Cargando...</p>}

      <div className="finanzas-config-grid">
        <div className="section">
          <h3>Cuentas (de dónde sale / entra el dinero)</h3>
          <div className="finanzas-simple-list">
            {accounts.map((a) => (
              <div key={a.id} className={`finanzas-simple-row${a.active ? '' : ' inactive'}`}>
                <span><strong>{a.name}</strong> <small>· {a.kind}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions">
                    <button className="btn-ghost" title="Editar" onClick={() => { setEditingAccount(a.id); setAccountName(a.name); setAccountKind(a.kind); }}>
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
              <button className="btn-primary" disabled={saving} onClick={saveAccount}>
                {editingAccount ? 'Guardar' : 'Agregar'}
              </button>
              {editingAccount && (
                <button className="btn-ghost" onClick={() => { setEditingAccount(null); setAccountName(''); }}>
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
                <span><strong>{c.name}</strong> <small>· {c.kind === 'AMBOS' ? 'ambos' : c.kind.toLowerCase()}</small></span>
                {canWrite && (
                  <span className="finanzas-row-actions">
                    <button className="btn-ghost" title="Editar" onClick={() => { setEditingCategory(c.id); setCategoryName(c.name); setCategoryKind(c.kind); }}>
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
      </div>
    </div>
  );
};

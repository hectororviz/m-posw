import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, normalizeApiError } from '../api/client';
import { useQuickExpenseButtonsAll, useImputableAssetAccounts, useImputableExpenseAccounts } from '../api/queries';
import { useToast } from '../components/ToastProvider';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { QuickExpenseButton } from '../api/types';

export const TreasuryQuickExpenseConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: buttons } = useQuickExpenseButtonsAll();
  const { data: assetAccounts } = useImputableAssetAccounts();
  const { data: expenseAccounts } = useImputableExpenseAccounts();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<QuickExpenseButton | null>(null);

  const [form, setForm] = useState({ label: '', assetAccountId: '', expenseAccountId: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm({ label: '', assetAccountId: '', expenseAccountId: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (btn: QuickExpenseButton) => {
    setEditingId(btn.id);
    setForm({ label: btn.label, assetAccountId: btn.assetAccountId, expenseAccountId: btn.expenseAccountId });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    setFormError(null);
    if (!form.label.trim() || !form.assetAccountId || !form.expenseAccountId) {
      setFormError('Completá todos los campos');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.patch(`/treasury/quick-expense/buttons/${editingId}`, form);
        pushToast('Botón actualizado', 'success');
      } else {
        await apiClient.post('/treasury/quick-expense/buttons', form);
        pushToast('Botón creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['quick-expense-buttons-all'] });
      queryClient.invalidateQueries({ queryKey: ['quick-expense-buttons'] });
      setModalOpen(false);
    } catch (err: any) {
      setFormError(normalizeApiError(err) || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/treasury/quick-expense/buttons/${deleteConfirm.id}`);
      pushToast('Botón eliminado', 'success');
      queryClient.invalidateQueries({ queryKey: ['quick-expense-buttons-all'] });
      queryClient.invalidateQueries({ queryKey: ['quick-expense-buttons'] });
      setDeleteConfirm(null);
    } catch (err: any) { pushToast(normalizeApiError(err) || 'Error al eliminar', 'error'); }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Configuración de Gastos Rápidos</h2>
      </div>

      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Configurá los botones que aparecen en la pantalla de Gastos. Cada botón representa un tipo de gasto con una cuenta de origen y destino predefinidas.
      </p>

      <div className="sales-table-wrapper" style={{ marginBottom: '1rem' }}>
        <div className="sales-table">
          <div className="sales-table-head">
            <span className="col-user" style={{ flex: 1 }}>Etiqueta</span>
            <span className="col-user" style={{ flex: 1.5 }}>Cuenta origen</span>
            <span className="col-user" style={{ flex: 1.5 }}>Cuenta destino</span>
            <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right' }}></span>
          </div>
          {(buttons ?? []).map((btn) => (
            <div key={btn.id} className="sales-table-row">
              <span className="col-user" style={{ flex: 1, fontWeight: 500 }}>{btn.label}</span>
              <span className="col-user" style={{ flex: 1.5, fontSize: '0.85rem' }}>{btn.assetAccount.code} — {btn.assetAccount.name}</span>
              <span className="col-user" style={{ flex: 1.5, fontSize: '0.85rem' }}>{btn.expenseAccount.code} — {btn.expenseAccount.name}</span>
              <span className="col-action" style={{ flex: '0 0 80px', textAlign: 'right', display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => openEdit(btn)} title="Editar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}><Pencil size={14} /></button>
                <button className="btn-ghost" onClick={() => setDeleteConfirm(btn)} title="Eliminar" style={{ padding: '0.3rem 0.4rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
          {(buttons ?? []).length === 0 && (
            <div className="sales-table-row"><span style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No hay botones configurados</span></div>
          )}
        </div>
      </div>

      <button type="button" className="fab-button-v2" onClick={openCreate} aria-label="Nuevo botón" title="Nuevo botón">
        <Plus size={24} />
      </button>

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar botón' : 'Nuevo botón'}</h3>
              <button className="icon-button" onClick={closeModal}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {formError && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{formError}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="settings-field">
                  <label>Etiqueta</label>
                  <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder='Ej: "Insumos", "Limpieza"' />
                </div>
                <div className="settings-field">
                  <label>Cuenta de origen (de dónde sale el dinero)</label>
                  <select value={form.assetAccountId} onChange={(e) => setForm({ ...form, assetAccountId: e.target.value })}>
                    <option value="">Seleccionar cuenta...</option>
                    {(assetAccounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Cuenta de destino (concepto del gasto)</label>
                  <select value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
                    <option value="">Seleccionar cuenta...</option>
                    {(expenseAccounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar botón</h3>
              <button className="icon-button" onClick={() => setDeleteConfirm(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>¿Eliminar el botón "{deleteConfirm.label}"?</p>
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleDelete} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

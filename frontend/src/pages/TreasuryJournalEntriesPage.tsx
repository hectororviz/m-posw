import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { normalizeApiError } from '../api/client';
import {
  useJournalEntries,
  useImputableAssetAccounts,
  useImputableRevenueAccounts,
  useImputableExpenseAccounts,
  useJournalEntry,
  useLedgerAccounts,
} from '../api/queries';
import type { EntryLineInput, JournalEntry, LedgerAccount } from '../api/types';

const formatCurrency = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'badge badge-neutral',
    POSTED: 'badge badge-success',
    VOIDED: 'badge badge-warning',
  };
  return map[status] || 'badge badge-neutral';
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = { DRAFT: 'Borrador', POSTED: 'Confirmado', VOIDED: 'Anulado' };
  return map[status] || status;
};

export const TreasuryJournalEntriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: entries, isLoading } = useJournalEntries({
    from: from || undefined,
    to: to || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'income' | 'expense' | 'advanced' | 'detail' | 'void'>('income');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const { data: detailEntry } = useJournalEntry(
    modalMode === 'detail' || modalMode === 'void' ? selectedEntryId! : undefined,
  );

  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['treasury-journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-journal-entry'] });
    queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
  };

  const openModal = (mode: 'income' | 'expense' | 'advanced' | 'detail' | 'void', entryId?: string) => {
    setError(null);
    setModalMode(mode);
    setSelectedEntryId(entryId || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEntryId(null);
    setError(null);
  };

  const handlePost = async (id: string) => {
    try {
      await apiClient.post(`/treasury/entries/${id}/post`);
      invalidate();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este asiento borrador?')) return;
    try {
      await apiClient.delete(`/treasury/entries/${id}`);
      invalidate();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleQuickSave = async (mode: 'income' | 'expense', data: any) => {
    setError(null);
    try {
      await apiClient.post(`/treasury/entries/${mode}`, data);
      invalidate();
      closeModal();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleAdvancedSave = async (data: any) => {
    setError(null);
    try {
      await apiClient.post('/treasury/entries', data);
      invalidate();
      closeModal();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleVoid = async (reason: string) => {
    if (!selectedEntryId) return;
    setError(null);
    try {
      await apiClient.post(`/treasury/entries/${selectedEntryId}/void`, { reason });
      invalidate();
      closeModal();
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const totalDebit = (e: JournalEntry) =>
    e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = (e: JournalEntry) =>
    e.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <div className="treasury-page">
      <div className="page-header">
        <div>
          <h2>Libro Diario</h2>
          <p className="page-subtitle">Registro de asientos contables</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-primary" onClick={() => openModal('income')}>Nuevo movimiento</button>
          <button className="btn-ghost" onClick={() => openModal('advanced')}>Crear asiento avanzado</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="filter-field">
          <label>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="filter-field">
          <label>Estado</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="POSTED">Confirmado</option>
            <option value="VOIDED">Anulado</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Buscar</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Descripción o número..." />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading && <p className="loading-text">Cargando...</p>}

      {entries && entries.length === 0 && <p className="empty-text">No hay asientos registrados.</p>}

      {entries && entries.length > 0 && (
        <div className="treasury-table-wrapper">
          <div className="treasury-table">
            <div className="treasury-table-head">
              <span>Asiento</span>
              <span>Fecha</span>
              <span>Descripción</span>
              <span>Estado</span>
              <span>Debe</span>
              <span>Haber</span>
              <span>Creado por</span>
              <span>Acciones</span>
            </div>
            {entries.map((e) => (
              <div key={e.id} className="treasury-table-row">
                <span>{e.entryNumber}</span>
                <span>{formatDate(e.date)}</span>
                <span className="truncate">{e.description}</span>
                <span><span className={statusBadge(e.status)}>{statusLabel(e.status)}</span></span>
                <span>{formatCurrency(totalDebit(e))}</span>
                <span>{formatCurrency(totalCredit(e))}</span>
                <span>{e.createdBy?.name || '-'}</span>
                <span className="action-buttons">
                  <button className="btn-ghost btn-sm" onClick={() => openModal('detail', e.id)}>Ver</button>
                  {e.status === 'DRAFT' && (
                    <>
                      <button className="btn-ghost btn-sm" onClick={() => handlePost(e.id)}>Confirmar</button>
                      <button className="btn-ghost btn-sm btn-danger" onClick={() => handleDelete(e.id)}>Eliminar</button>
                    </>
                  )}
                  {e.status === 'POSTED' && (
                    <button className="btn-ghost btn-sm btn-warning" onClick={() => openModal('void', e.id)}>Anular</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && modalMode === 'income' && (
        <SimpleEntryModal
          type="income"
          onClose={closeModal}
          onSave={handleQuickSave}
          error={error}
        />
      )}
      {showModal && modalMode === 'expense' && (
        <SimpleEntryModal
          type="expense"
          onClose={closeModal}
          onSave={handleQuickSave}
          error={error}
        />
      )}
      {showModal && modalMode === 'advanced' && (
        <AdvancedEntryModal
          onClose={closeModal}
          onSave={handleAdvancedSave}
          error={error}
        />
      )}
      {showModal && modalMode === 'detail' && detailEntry && (
        <DetailModal entry={detailEntry} onClose={closeModal} />
      )}
      {showModal && modalMode === 'void' && (
        <VoidModal onClose={closeModal} onVoid={handleVoid} entryNumber={detailEntry?.entryNumber || ''} error={error} />
      )}
    </div>
  );
};

// Simple entry modal (income or expense)
const SimpleEntryModal: React.FC<{
  type: 'income' | 'expense';
  onClose: () => void;
  onSave: (mode: string, data: any) => void;
  error: string | null;
}> = ({ type, onClose, onSave, error }) => {
  const { data: assetAccounts } = useImputableAssetAccounts();
  const { data: revenueAccounts } = useImputableRevenueAccounts();
  const { data: expenseAccounts } = useImputableExpenseAccounts();

  const [date, setDate] = useState(todayStr());
  const [assetId, setAssetId] = useState('');
  const [ieAccountId, setIeAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAs, setSaveAs] = useState<'DRAFT' | 'POSTED'>('POSTED');

  const title = type === 'income' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
  const ieLabel = type === 'income' ? 'Concepto de ingreso' : 'Concepto de gasto';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(type, {
      date,
      assetAccountId: assetId,
      incomeExpenseAccountId: ieAccountId,
      amount: Number(amount),
      description,
      notes: notes || undefined,
      status: saveAs,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <div className="settings-field">
              <label>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="settings-field">
              <label>Cuenta {type === 'income' ? 'donde ingresa' : 'desde donde sale'}</label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required>
                <option value="">Seleccionar cuenta</option>
                {(assetAccounts || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label>{ieLabel}</label>
              <select value={ieAccountId} onChange={(e) => setIeAccountId(e.target.value)} required>
                <option value="">Seleccionar cuenta</option>
                {type === 'income'
                  ? (revenueAccounts || []).map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)
                  : (expenseAccounts || []).map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)
                }
              </select>
            </div>
            <div className="settings-field">
              <label>Importe</label>
              <div className="price-input-wrapper">
                <span className="price-input-symbol">$</span>
                <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="settings-field">
              <label>Descripción</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="settings-field">
              <label>Observaciones (opcional)</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <label className="toggle-switch" style={{ marginRight: 'auto' }}>
              <input type="checkbox" checked={saveAs === 'DRAFT'} onChange={(e) => setSaveAs(e.target.checked ? 'DRAFT' : 'POSTED')} />
              <span className="toggle-switch-track" />
              Guardar como borrador
            </label>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {saveAs === 'DRAFT' ? 'Guardar borrador' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Advanced entry modal
const AdvancedEntryModal: React.FC<{
  onClose: () => void;
  onSave: (data: any) => void;
  error: string | null;
}> = ({ onClose, onSave, error }) => {
  const { data: accounts } = useLedgerAccounts();
  const imputableAccounts = useMemo(
    () => (accounts || []).filter((a) => a.acceptsEntries && a.active),
    [accounts],
  );

  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAs, setSaveAs] = useState<'DRAFT' | 'POSTED'>('POSTED');
  const [lines, setLines] = useState<{ accountId: string; debit: string; credit: string; desc: string }[]>([
    { accountId: '', debit: '', credit: '', desc: '' },
    { accountId: '', debit: '', credit: '', desc: '' },
  ]);

  const addLine = () => setLines([...lines, { accountId: '', debit: '', credit: '', desc: '' }]);
  const removeLine = (i: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: string, value: string) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    if (field === 'debit' && value !== '') {
      updated[i].credit = '';
    }
    if (field === 'credit' && value !== '') {
      updated[i].debit = '';
    }
    setLines(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.005 && totalDebit > 0 && totalCredit > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      date,
      description,
      notes: notes || undefined,
      status: saveAs,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.desc || undefined,
      })),
    };
    onSave(data);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal user-modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Asiento avanzado</h3>
          <button type="button" className="icon-button" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <div className="settings-field">
              <label>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="settings-field">
              <label>Descripción</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="settings-field">
              <label>Observaciones</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="entry-lines-section">
              <div className="entry-lines-header">
                <h4>Líneas del asiento</h4>
                <button type="button" className="btn-ghost btn-sm" onClick={addLine}>+ Agregar línea</button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="entry-line-row">
                  <div className="entry-line-account">
                    <select value={line.accountId} onChange={(e) => updateLine(i, 'accountId', e.target.value)} required>
                      <option value="">Seleccionar cuenta</option>
                      {imputableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="entry-line-amount">
                    <div className="price-input-wrapper">
                      <span className="price-input-symbol">Debe $</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(i, 'debit', e.target.value)} />
                    </div>
                  </div>
                  <div className="entry-line-amount">
                    <div className="price-input-wrapper">
                      <span className="price-input-symbol">Haber $</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(i, 'credit', e.target.value)} />
                    </div>
                  </div>
                  {lines.length > 2 && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => removeLine(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <div className="entry-balance-summary">
              <div className="balance-item">
                <span>Total Debe:</span>
                <strong>{formatCurrency(totalDebit)}</strong>
              </div>
              <div className="balance-item">
                <span>Total Haber:</span>
                <strong>{formatCurrency(totalCredit)}</strong>
              </div>
              <div className={`balance-item ${isBalanced ? 'balance-ok' : 'balance-err'}`}>
                <span>Diferencia:</span>
                <strong>{formatCurrency(diff)}</strong>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <label className="toggle-switch" style={{ marginRight: 'auto' }}>
              <input type="checkbox" checked={saveAs === 'DRAFT'} onChange={(e) => setSaveAs(e.target.checked ? 'DRAFT' : 'POSTED')} />
              <span className="toggle-switch-track" />
              Guardar como borrador
            </label>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!isBalanced && saveAs === 'POSTED'}>
              {saveAs === 'DRAFT' ? 'Guardar borrador' : 'Confirmar'}
            </button>
            {!isBalanced && saveAs === 'POSTED' && (
              <p className="hint-text">El asiento debe estar balanceado para confirmar</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Detail modal
const DetailModal: React.FC<{ entry: JournalEntry; onClose: () => void }> = ({ entry, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal user-modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Asiento {entry.entryNumber}</h3>
          <button type="button" className="icon-button" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="entry-detail-info">
            <div className="detail-row">
              <span className="detail-label">Fecha:</span>
              <span>{formatDate(entry.date)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Estado:</span>
              <span className={statusBadge(entry.status)}>{statusLabel(entry.status)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Creado por:</span>
              <span>{entry.createdBy?.name || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Descripción:</span>
              <span>{entry.description}</span>
            </div>
            {entry.notes && (
              <div className="detail-row">
                <span className="detail-label">Observaciones:</span>
                <span>{entry.notes}</span>
              </div>
            )}
            {entry.voidReason && (
              <div className="detail-row">
                <span className="detail-label">Motivo anulación:</span>
                <span>{entry.voidReason}</span>
              </div>
            )}
            {entry.reversalOf && (
              <div className="detail-row">
                <span className="detail-label">Anula a:</span>
                <span>{entry.reversalOf.entryNumber} - {entry.reversalOf.description}</span>
              </div>
            )}
            {entry.reversalEntry && (
              <div className="detail-row">
                <span className="detail-label">Anulado por:</span>
                <span>{entry.reversalEntry.entryNumber} - {entry.reversalEntry.description}</span>
              </div>
            )}
          </div>

          <div className="entry-lines-detail">
            <h4>Líneas</h4>
            <div className="treasury-table" style={{ marginTop: '8px' }}>
              <div className="treasury-table-head">
                <span>Cuenta</span>
                <span>Código</span>
                <span>Debe</span>
                <span>Haber</span>
              </div>
              {entry.lines.map((l) => (
                <div key={l.id} className="treasury-table-row">
                  <span>{l.account.name}</span>
                  <span>{l.account.code}</span>
                  <span>{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : '-'}</span>
                  <span>{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : '-'}</span>
                </div>
              ))}
              <div className="treasury-table-row" style={{ fontWeight: 600 }}>
                <span>Totales</span>
                <span />
                <span>{formatCurrency(entry.lines.reduce((s, l) => s + Number(l.debit), 0))}</span>
                <span>{formatCurrency(entry.lines.reduce((s, l) => s + Number(l.credit), 0))}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

// Void modal
const VoidModal: React.FC<{
  onClose: () => void;
  onVoid: (reason: string) => void;
  entryNumber: string;
  error: string | null;
}> = ({ onClose, onVoid, entryNumber, error }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onVoid(reason);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Anular asiento</h3>
          <button type="button" className="icon-button" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <p className="modal-description">
              Se creará un asiento inverso que anula el asiento <strong>{entryNumber}</strong>.
              El asiento original permanecerá visible como anulado.
            </p>
            <div className="settings-field">
              <label>Motivo de anulación *</label>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary btn-danger" disabled={!reason.trim()}>
              Anular asiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

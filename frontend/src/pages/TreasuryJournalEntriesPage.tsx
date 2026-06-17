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
import type { JournalEntry } from '../api/types';

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
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryInitialTab, setNewEntryInitialTab] = useState<'ingreso' | 'avanzado'>('ingreso');
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
      setShowNewEntryModal(false);
    } catch (err) {
      setError(normalizeApiError(err));
    }
  };

  const handleAdvancedSave = async (data: any) => {
    setError(null);
    try {
      await apiClient.post('/treasury/entries', data);
      invalidate();
      setShowNewEntryModal(false);
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

  const exportLedgerBook = async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const response = await apiClient.get(
        `/treasury/reports/export/ledger-book?${params.toString()}`,
        { responseType: 'blob' },
      );
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'libro-diario.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
  };

  const totalDebit = (e: JournalEntry) =>
    e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = (e: JournalEntry) =>
    e.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Movimientos</h2>
          <p className="page-subtitle">Registro de asientos contables</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-primary" onClick={() => { setError(null); setNewEntryInitialTab('ingreso'); setShowNewEntryModal(true); }}>
            ＋ Nuevo movimiento
          </button>
          <button className="btn-ghost" onClick={() => { setError(null); setNewEntryInitialTab('avanzado'); setShowNewEntryModal(true); }}>
            Asiento avanzado
          </button>
          <button className="btn-ghost" onClick={() => exportLedgerBook()}>
            Exportar Excel
          </button>
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
                <span>{e.createdBy?.username || '-'}</span>
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

      {showNewEntryModal && (
        <NewEntryModal
          key={newEntryInitialTab + String(Date.now())}
          initialMode={newEntryInitialTab === 'avanzado' ? 'avanzado' : 'ingreso'}
          onClose={() => { setShowNewEntryModal(false); setError(null); }}
          onSaveSimple={handleQuickSave}
          onSaveAdvanced={handleAdvancedSave}
          error={error}
        />
      )}
      {showModal && modalMode === 'detail' && detailEntry && (
        <DetailModal entry={detailEntry} onClose={closeModal} />
      )}
      {showModal && modalMode === 'void' && (
        <VoidModal onClose={closeModal} onVoid={handleVoid} entryNumber={detailEntry?.entryNumber || ''} error={error} />
      )}
    </>
  );
};

// ─── Parseo de moneda argentina  □━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseArsToNumber(input: string): number | null {
  if (!input) return null;
  let s = input.replace(/[$\s]/g, '').trim();
  if (!s) return null;

  // Si tiene coma, coma = decimal, puntos = miles
  if (s.includes(',')) {
    const [intRaw, decRaw] = s.split(',');
    const intPart = intRaw.replace(/\./g, '');
    const decPart = (decRaw || '0').replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    const val = parseFloat(intPart + '.' + decPart);
    return isNaN(val) ? null : val;
  }

  // Sin coma: contar puntos
  const dots = (s.match(/\./g) || []).length;
  if (dots === 0) {
    const val = parseInt(s.replace(/\D/g, ''));
    return isNaN(val) ? null : val;
  }

  if (dots === 1) {
    const idx = s.lastIndexOf('.');
    const after = s.slice(idx + 1);
    // 1 o 2 dígitos después del punto → decimal
    if (after.length <= 2 && /^\d+$/.test(after)) {
      const intPart = s.slice(0, idx).replace(/\D/g, '') || '0';
      const decPart = after.padEnd(2, '0');
      const val = parseFloat(intPart + '.' + decPart);
      return isNaN(val) ? null : val;
    }
    // Más dígitos → punto de miles
    const val = parseInt(s.replace(/\./g, ''));
    return isNaN(val) ? null : val;
  }

  // Múltiples puntos → todos son separadores de miles
  const val = parseInt(s.replace(/\./g, ''));
  return isNaN(val) ? null : val;
}

// ─── Formateo a display argentino  □━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function formatArsDisplay(normalized: string): string {
  const num = parseFloat(normalized);
  if (isNaN(num) || num === 0) return '';
  const parts = num.toFixed(2).split('.');
  const intFormatted = parseInt(parts[0], 10).toLocaleString('de-DE');
  return `${intFormatted},${parts[1]}`;
}

// ─── CurrencyInput  □━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CurrencyInput: React.FC<{
  value: string;
  onChange: (normalized: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const [editValue, setEditValue] = useState('');

  const num = parseFloat(value);
  const hasValue = value !== '' && !isNaN(num) && num > 0;

  // Qué mostrar en el input
  let displayValue: string;
  if (focused) {
    displayValue = editValue;
  } else if (hasValue) {
    displayValue = formatArsDisplay(value);
  } else {
    displayValue = '';
  }

  const handleFocus = () => {
    setFocused(true);
    // Al enfocar, mostrar versión editable: sin formato de miles
    if (hasValue) {
      const parts = value.split('.');
      const intPart = parts[0];
      const decPart = parts[1] || '00';
      if (decPart === '00') {
        setEditValue(intPart);
      } else {
        setEditValue(`${intPart},${decPart}`);
      }
    } else {
      setEditValue('');
    }
  };

  const handleBlur = () => {
    setFocused(false);
    // Al perder foco, normalizar a 2 decimales
    if (value !== '') {
      const n = parseFloat(value);
      if (!isNaN(n) && n > 0) {
        onChange(n.toFixed(2));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Quitar todo excepto dígitos, coma, punto
    const cleaned = raw.replace(/[^0-9,.]/g, '');
    setEditValue(cleaned);

    if (cleaned === '') {
      onChange('');
      return;
    }

    const parsed = parseArsToNumber(cleaned);
    if (parsed !== null && parsed >= 0) {
      onChange(parsed.toString());
    }
    // Si parsed es null, no actualizamos (el usuario está en medio de escribir algo inválido)
  };

  return (
    <div className="currency-input">
      <span className="currency-input-prefix">$</span>
      <input
        className="currency-input-field"
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || '0,00'}
        autoComplete="off"
      />
    </div>
  );
};

// ─── Unified Nuevo movimiento modal □━━━━━━━━━━━━━━━━━━━━━━━━━
const NewEntryModal: React.FC<{
  initialMode: 'ingreso' | 'avanzado';
  onClose: () => void;
  onSaveSimple: (mode: 'income' | 'expense', data: any) => Promise<void>;
  onSaveAdvanced: (data: any) => void;
  error: string | null;
}> = ({ initialMode, onClose, onSaveSimple, onSaveAdvanced, error }) => {
  const { data: assetAccounts } = useImputableAssetAccounts();
  const { data: revenueAccounts } = useImputableRevenueAccounts();
  const { data: expenseAccounts } = useImputableExpenseAccounts();
  const { data: allAccounts } = useLedgerAccounts();
  const imputableAccounts = useMemo(
    () => (allAccounts || []).filter((a) => a.acceptsEntries && a.active),
    [allAccounts],
  );

  const [tab, setTab] = useState<'ingreso' | 'gasto' | 'avanzado'>(initialMode);
  const [tabConfirm, setTabConfirm] = useState<'ingreso' | 'gasto' | 'avanzado' | null>(null);

  // Simple fields
  const [date, setDate] = useState(todayStr());
  const [assetId, setAssetId] = useState('');
  const [ieAccountId, setIeAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Advanced fields
  const [advancedDate, setAdvancedDate] = useState(todayStr());
  const [advancedDesc, setAdvancedDesc] = useState('');
  const [advancedNotes, setAdvancedNotes] = useState('');
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
    if (field === 'debit' && value !== '') updated[i].credit = '';
    if (field === 'credit' && value !== '') updated[i].debit = '';
    setLines(updated);
  };

  const advTotalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const advTotalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const advDiff = Math.abs(advTotalDebit - advTotalCredit);
  const advHasDebit = lines.some((l) => parseFloat(l.debit) > 0);
  const advHasCredit = lines.some((l) => parseFloat(l.credit) > 0);
  const advAllAccountsSelected = lines.every((l) => l.accountId !== '');
  const isBalanced = advDiff < 0.005 && advTotalDebit > 0 && advTotalCredit > 0;

  const parseAmount = (raw: string) => parseFloat(raw) || 0;

  const hasSimpleData = date !== todayStr() || assetId || ieAccountId || amount || description || notes;
  const hasAdvancedData = advancedDate !== todayStr() || advancedDesc || advancedNotes ||
    lines.some((l) => l.accountId || l.debit || l.credit || l.desc);

  const confirmTabChange = (newTab: 'ingreso' | 'gasto' | 'avanzado') => {
    const currentHasData = tab === 'avanzado' ? hasAdvancedData : hasSimpleData;
    if (currentHasData && newTab !== tab) {
      setTabConfirm(newTab);
    } else {
      setTab(newTab);
      resetSimple();
    }
  };

  const doTabChange = () => {
    if (tabConfirm) {
      setTab(tabConfirm);
      resetSimple();
      setTabConfirm(null);
    }
  };

  const resetSimple = () => {
    setDate(todayStr());
    setAssetId('');
    setIeAccountId('');
    setAmount('');
    setDescription('');
    setNotes('');
    setTouched({});
  };

  const simpleValid = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Requerido';
    if (!assetId) errs.assetId = 'Requerido';
    if (!ieAccountId) errs.ieAccountId = 'Requerido';
    if (!amount || parseAmount(amount) <= 0) errs.amount = 'Ingrese un importe mayor a cero';
    if (!description.trim()) errs.description = 'Requerido';
    return errs;
  };

  const handleSimpleSubmit = (mode: 'income' | 'expense', isDraft: boolean) => (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTouched({ date: true, assetId: true, ieAccountId: true, amount: true, description: true });
    const errs = simpleValid();
    if (Object.keys(errs).length > 0 && !isDraft) return;
    if (!amount || parseAmount(amount) <= 0) return;
    onSaveSimple(mode, {
      date,
      assetAccountId: assetId,
      incomeExpenseAccountId: ieAccountId,
      amount: parseAmount(amount),
      description,
      notes: notes || undefined,
      status: isDraft ? 'DRAFT' : 'POSTED',
    });
  };

  const handleAdvancedSubmit = (isDraft: boolean) => (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveAdvanced({
      date: advancedDate,
      description: advancedDesc,
      notes: advancedNotes || undefined,
      status: isDraft ? 'DRAFT' : 'POSTED',
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.desc || undefined,
      })),
    });
  };

  const simpleErrs = simpleValid();

  let advBlockMsg = '';
  if (!advAllAccountsSelected) advBlockMsg = 'Seleccione una cuenta para cada línea';
  else if (!advHasDebit) advBlockMsg = 'Debe existir al menos una línea en el Debe';
  else if (!advHasCredit) advBlockMsg = 'Debe existir al menos una línea en el Haber';
  else if (!isBalanced) advBlockMsg = 'El asiento debe estar balanceado';
  else if (!advancedDesc.trim()) advBlockMsg = 'La descripción es requerida';

  const canConfirmAdv = isBalanced && advAllAccountsSelected && advHasDebit && advHasCredit && advancedDesc.trim();

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal user-modal new-entry-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Nuevo movimiento</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div className="error-banner">{error}</div>}

          <div className="entry-type-tabs">
            <button
              className={`entry-type-tab ${tab === 'ingreso' ? 'active' : ''}`}
              onClick={() => tab === 'ingreso' ? null : confirmTabChange('ingreso')}
              type="button"
            >
              Ingreso
            </button>
            <button
              className={`entry-type-tab ${tab === 'gasto' ? 'active' : ''}`}
              onClick={() => tab === 'gasto' ? null : confirmTabChange('gasto')}
              type="button"
            >
              Gasto
            </button>
            <button
              className={`entry-type-tab ${tab === 'avanzado' ? 'active' : ''}`}
              onClick={() => tab === 'avanzado' ? null : confirmTabChange('avanzado')}
              type="button"
            >
              Avanzado
            </button>
          </div>

          {tab === 'ingreso' && (
            <>
              <div className="settings-field">
                <label>Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {touched.date && simpleErrs.date && <span className="field-error">{simpleErrs.date}</span>}
              </div>
              <div className="settings-field">
                <label>Cuenta donde ingresa el dinero</label>
                <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">Seleccionar cuenta</option>
                  {(assetAccounts || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                {touched.assetId && simpleErrs.assetId && <span className="field-error">{simpleErrs.assetId}</span>}
              </div>
              <div className="settings-field">
                <label>Concepto del ingreso</label>
                <select value={ieAccountId} onChange={(e) => setIeAccountId(e.target.value)}>
                  <option value="">Seleccionar cuenta de ingreso</option>
                  {(revenueAccounts || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                {touched.ieAccountId && simpleErrs.ieAccountId && <span className="field-error">{simpleErrs.ieAccountId}</span>}
              </div>
              <div className="settings-field">
                <label>Importe</label>
                <CurrencyInput value={amount} onChange={setAmount} />
                {touched.amount && simpleErrs.amount && <span className="field-error">{simpleErrs.amount}</span>}
              </div>
              <div className="settings-field">
                <label>Descripción</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
                {touched.description && simpleErrs.description && <span className="field-error">{simpleErrs.description}</span>}
              </div>
              <div className="settings-field">
                <label>Observaciones (opcional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {tab === 'gasto' && (
            <>
              <div className="settings-field">
                <label>Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {touched.date && simpleErrs.date && <span className="field-error">{simpleErrs.date}</span>}
              </div>
              <div className="settings-field">
                <label>Concepto del gasto</label>
                <select value={ieAccountId} onChange={(e) => setIeAccountId(e.target.value)}>
                  <option value="">Seleccionar cuenta de gasto</option>
                  {(expenseAccounts || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                {touched.ieAccountId && simpleErrs.ieAccountId && <span className="field-error">{simpleErrs.ieAccountId}</span>}
              </div>
              <div className="settings-field">
                <label>Cuenta desde donde sale el dinero</label>
                <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">Seleccionar cuenta de activo</option>
                  {(assetAccounts || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                {touched.assetId && simpleErrs.assetId && <span className="field-error">{simpleErrs.assetId}</span>}
              </div>
              <div className="settings-field">
                <label>Importe</label>
                <CurrencyInput value={amount} onChange={setAmount} />
                {touched.amount && simpleErrs.amount && <span className="field-error">{simpleErrs.amount}</span>}
              </div>
              <div className="settings-field">
                <label>Descripción</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
                {touched.description && simpleErrs.description && <span className="field-error">{simpleErrs.description}</span>}
              </div>
              <div className="settings-field">
                <label>Observaciones (opcional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {tab === 'avanzado' && (
            <>
              <div className="settings-field">
                <label>Fecha</label>
                <input type="date" value={advancedDate} onChange={(e) => setAdvancedDate(e.target.value)} />
              </div>
              <div className="settings-field">
                <label>Descripción</label>
                <input type="text" value={advancedDesc} onChange={(e) => setAdvancedDesc(e.target.value)} />
              </div>
              <div className="settings-field">
                <label>Observaciones (opcional)</label>
                <textarea rows={2} value={advancedNotes} onChange={(e) => setAdvancedNotes(e.target.value)} />
              </div>

              <div className="entry-lines-section">
                <div className="entry-lines-header">
                  <h4>Líneas del asiento</h4>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="entry-line-card">
                    <div className="entry-line-card__head">
                      <span className="entry-line-card__num">Línea {i + 1}</span>
                      {lines.length > 2 && (
                        <button type="button" className="btn-ghost btn-sm" onClick={() => removeLine(i)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                    <div className="entry-line-card__account">
                      <select value={line.accountId} onChange={(e) => updateLine(i, 'accountId', e.target.value)}>
                        <option value="">Seleccionar cuenta contable</option>
                        {imputableAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="entry-line-card__amounts">
                      <div className="entry-line-card__amount">
                        <label>Debe</label>
                        <CurrencyInput
                          value={line.debit}
                          onChange={(v) => updateLine(i, 'debit', v)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="entry-line-card__amount">
                        <label>Haber</label>
                        <CurrencyInput
                          value={line.credit}
                          onChange={(v) => updateLine(i, 'credit', v)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-ghost btn-sm" onClick={addLine} style={{ marginTop: 8 }}>
                  ＋ Agregar línea
                </button>
              </div>

              <div className="entry-balance-summary">
                <div className="balance-item"><span>Total Debe</span><strong>{formatCurrency(advTotalDebit)}</strong></div>
                <div className="balance-item"><span>Total Haber</span><strong>{formatCurrency(advTotalCredit)}</strong></div>
                <div className={`balance-item ${isBalanced ? 'balance-ok' : 'balance-err'}`}>
                  <span>Diferencia</span><strong>{formatCurrency(advDiff)}</strong>
                </div>
              </div>
              {advBlockMsg && <p className="hint-text">{advBlockMsg}</p>}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer new-entry-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          {tab !== 'avanzado' ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSimpleSubmit(tab === 'ingreso' ? 'income' : 'expense', true)()}
              >
                Guardar borrador
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSimpleSubmit(tab === 'ingreso' ? 'income' : 'expense', false)()}
              >
                Confirmar movimiento
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleAdvancedSubmit(true)()}
              >
                Guardar borrador
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!canConfirmAdv}
                onClick={() => handleAdvancedSubmit(false)()}
              >
                Confirmar asiento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab change confirmation mini-modal */}
      {tabConfirm && (
        <div className="modal-backdrop" style={{ zIndex: 1001 }} role="presentation">
          <div className="modal user-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cambiar tipo</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--color-text-body)', fontSize: '0.9rem' }}>
                Al cambiar de tipo de movimiento se perderán los datos ingresados. ¿Continuar?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={() => setTabConfirm(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={doTabChange}>
                Cambiar y descartar
              </button>
            </div>
          </div>
        </div>
      )}
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
              <span>{entry.createdBy?.username || '-'}</span>
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

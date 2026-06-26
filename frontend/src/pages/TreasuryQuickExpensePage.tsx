import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useQuickExpenseButtons, useJournalEntries } from '../api/queries';
import { useToast } from '../components/ToastProvider';
import type { QuickExpenseButton } from '../api/types';
import { DollarSign } from 'lucide-react';

export const TreasuryQuickExpensePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: buttons } = useQuickExpenseButtons();
  const { data: recentEntries } = useJournalEntries({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    status: 'POSTED',
  });

  const [activeButton, setActiveButton] = useState<QuickExpenseButton | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!activeButton || !amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      await apiClient.post('/treasury/quick-expense/buttons/submit', {
        buttonId: activeButton.id,
        amount: parseFloat(amount),
        note: note || undefined,
      });
      pushToast(`Gasto registrado: $${parseFloat(amount).toLocaleString('es-AR')} en ${activeButton.label}`, 'success');
      setActiveButton(null);
      setAmount('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
    } catch (err: any) {
      pushToast(err?.response?.data?.message || 'Error al registrar gasto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const entries = (recentEntries as any)?.data ?? (recentEntries as any[]) ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Gastos rápidos</h2>
      </div>

      {activeButton ? (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span className="btn-ghost" onClick={() => { setActiveButton(null); setAmount(''); setNote(''); }} style={{ padding: '0.25rem 0.5rem', fontSize: '1rem', cursor: 'pointer' }}>← Volver</span>
              <strong style={{ fontSize: '1.1rem' }}>{activeButton.label}</strong>
            </div>

            <div className="settings-field" style={{ marginBottom: '1rem' }}>
              <label>Monto</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0.00"
                autoFocus
                style={{ fontSize: '1.5rem', padding: '0.75rem', textAlign: 'center', fontWeight: 700 }}
              />
            </div>

            <div className="settings-field" style={{ marginBottom: '1rem' }}>
              <label>Nota (opcional)</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Factura B 0001" />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              <span>Origen: {activeButton.assetAccount.name}</span>
              <span>•</span>
              <span>Destino: {activeButton.expenseAccount.name}</span>
            </div>

            <button
              className="btn-primary"
              disabled={!amount || parseFloat(amount) <= 0 || saving}
              onClick={handleSubmit}
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.1rem', fontWeight: 700 }}
            >
              {saving ? 'Registrando...' : `Registrar gasto $${amount ? parseFloat(amount).toLocaleString('es-AR') : '0'}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {(buttons ?? []).map((btn) => (
              <button
                key={btn.id}
                className="card"
                onClick={() => setActiveButton(btn)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.25rem 0.75rem',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.75rem',
                  background: 'var(--color-surface)',
                  textAlign: 'center',
                  minHeight: '130px',
                  transition: 'all 0.15s',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'var(--accent-color, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <DollarSign size={24} color="#fff" />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{btn.label}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{btn.expenseAccount.name}</span>
              </button>
            ))}
            {(buttons ?? []).length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <p>No hay botones de gasto configurados.</p>
                <p style={{ fontSize: '0.85rem' }}>Andá a Configuración para crear botones rápidos.</p>
              </div>
            )}
          </div>

          {Array.isArray(entries) && entries.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Últimos gastos del día</h3>
              <div className="sales-table-wrapper">
                <div className="sales-table">
                  <div className="sales-table-head">
                    <span className="col-date" style={{ flex: '0 0 90px' }}>Hora</span>
                    <span className="col-user" style={{ flex: 2 }}>Concepto</span>
                    <span className="col-num" style={{ flex: '0 0 100px', textAlign: 'right' }}>Importe</span>
                  </div>
                  {entries.map((entry: any) => {
                    const expenseLine = entry.lines?.find((l: any) => Number(l.debit) > 0);
                    const assetLine = entry.lines?.find((l: any) => Number(l.credit) > 0);
                    const concept = expenseLine?.account?.name ?? entry.description;
                    const cashAccount = assetLine?.account?.name ?? '';
                    return (
                      <div key={entry.id} className="sales-table-row">
                        <span className="col-date" style={{ flex: '0 0 90px', fontSize: '0.85rem' }}>
                          {new Date(entry.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="col-user" style={{ flex: 2 }}>
                          {concept}
                          <br />
                          <small style={{ color: 'var(--color-text-muted)' }}>{cashAccount}</small>
                        </span>
                        <span className="col-num" style={{ flex: '0 0 100px', textAlign: 'right', fontWeight: 600, color: 'var(--color-danger)' }}>
                          {expenseLine ? '$' + Number(expenseLine.debit).toLocaleString('es-AR') : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

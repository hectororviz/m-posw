import { useState } from 'react';
import { apiClient } from '../api/client';
import { useLedgerAccounts, useLedgerBook, useLedgerAccountDetail, useTrialBalance, useIncomeStatement, useAvailabilities } from '../api/queries';
import type { TrialBalanceData, IncomeStatementData, AvailabilityData, LedgerAccountDetail, LedgerBookRow } from '../api/types';

const formatCurrency = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const formatDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

type ReportTab = 'ledger' | 'mayor' | 'balance' | 'results' | 'availabilities';

export const TreasuryReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('ledger');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [asOf, setAsOf] = useState('');

  const { data: accounts } = useLedgerAccounts();
  const imputableAccounts = (accounts || []).filter((a) => a.acceptsEntries);

  const commonParams = {
    from: from || undefined,
    to: to || undefined,
  };

  const { data: ledgerBook, isLoading: ledgerLoading } = useLedgerBook(
    activeTab === 'ledger' ? commonParams : undefined,
  );
  const { data: mayorData, isLoading: mayorLoading } = useLedgerAccountDetail(
    activeTab === 'mayor' && selectedAccountId ? selectedAccountId : undefined,
    commonParams,
  );
  const { data: trialBalance, isLoading: balanceLoading } = useTrialBalance(
    activeTab === 'balance' ? commonParams : undefined,
  );
  const { data: incomeStatement, isLoading: resultsLoading } = useIncomeStatement(
    activeTab === 'results' ? commonParams : undefined,
  );
  const { data: availabilities, isLoading: availLoading } = useAvailabilities(
    activeTab === 'availabilities' ? (asOf || undefined) : undefined,
  );

  const showFilters = activeTab !== 'availabilities';

  const exportDownload = async (path: string, filename: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (selectedAccountId) params.set('accountId', selectedAccountId);
    if (asOf) params.set('asOf', asOf);
    const qs = params.toString();
    const url = `${path}${qs ? `?${qs}` : ''}`;
    try {
      const response = await apiClient.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    } catch { /* ignore download errors */ }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Reportes</h2>
          <p className="page-subtitle">Libro Diario, Mayor, Balance y más</p>
        </div>
      </div>

      {showFilters && (
        <div className="filter-bar">
          <div className="filter-field">
            <label>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {activeTab === 'mayor' && (
            <div className="filter-field">
              <label>Cuenta</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                <option value="">Seleccionar cuenta</option>
                {imputableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      {activeTab === 'availabilities' && (
        <div className="filter-bar">
          <div className="filter-field">
            <label>Fecha de corte</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        </div>
      )}

      <div className="report-tabs">
        {[
          { key: 'ledger', label: 'Libro Diario', exportPath: '/treasury/reports/export/ledger-book', exportFile: 'libro-diario.xlsx' },
          { key: 'mayor', label: 'Mayor', exportPath: '/treasury/reports/export/ledger-account', exportFile: 'mayor-contable.xlsx' },
          { key: 'balance', label: 'Balance', exportPath: '/treasury/reports/export/trial-balance', exportFile: 'balance-sumas-saldos.xlsx' },
          { key: 'results', label: 'Estado de Resultados', exportPath: '/treasury/reports/export/income-statement', exportFile: 'estado-resultados.xlsx' },
          { key: 'availabilities', label: 'Disponibilidades', exportPath: '/treasury/reports/export/availabilities', exportFile: 'disponibilidades.xlsx' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`report-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as ReportTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="report-actions">
        {activeTab === 'ledger' && (
          <button className="btn-ghost" onClick={() => exportDownload('/treasury/reports/export/ledger-book', 'libro-diario.xlsx')}>
            Exportar Excel
          </button>
        )}
        {activeTab === 'mayor' && selectedAccountId && (
          <button className="btn-ghost" onClick={() => exportDownload('/treasury/reports/export/ledger-account', 'mayor-contable.xlsx')}>
            Exportar Excel
          </button>
        )}
        {activeTab === 'balance' && (
          <button className="btn-ghost" onClick={() => exportDownload('/treasury/reports/export/trial-balance', 'balance-sumas-saldos.xlsx')}>
            Exportar Excel
          </button>
        )}
        {activeTab === 'results' && (
          <button className="btn-ghost" onClick={() => exportDownload('/treasury/reports/export/income-statement', 'estado-resultados.xlsx')}>
            Exportar Excel
          </button>
        )}
        {activeTab === 'availabilities' && (
          <button className="btn-ghost" onClick={() => exportDownload('/treasury/reports/export/availabilities', 'disponibilidades.xlsx')}>
            Exportar Excel
          </button>
        )}
      </div>

      <div className="report-content">
        {activeTab === 'ledger' && <LedgerBookTable data={ledgerBook} loading={ledgerLoading} />}
        {activeTab === 'mayor' && <MayorTable data={mayorData} loading={mayorLoading} accountId={selectedAccountId} />}
        {activeTab === 'balance' && <TrialBalanceTable data={trialBalance} loading={balanceLoading} />}
        {activeTab === 'results' && <IncomeStatementView data={incomeStatement} loading={resultsLoading} />}
        {activeTab === 'availabilities' && <AvailabilitiesView data={availabilities} loading={availLoading} />}
      </div>
    </>
  );
};

const LedgerBookTable: React.FC<{ data?: LedgerBookRow[]; loading: boolean }> = ({ data, loading }) => {
  if (loading) return <p className="loading-text">Cargando...</p>;
  if (!data || data.length === 0) return <p className="empty-text">Sin datos para el período seleccionado.</p>;
  return (
    <div className="treasury-table-wrapper">
      <div className="treasury-table">
        <div className="treasury-table-head">
          <span>Asiento</span>
          <span>Fecha</span>
          <span>Descripción</span>
          <span>Código</span>
          <span>Cuenta</span>
          <span>Debe</span>
          <span>Haber</span>
        </div>
        {data.map((row, i) => (
          <div key={i} className="treasury-table-row">
            <span>{row.entryNumber}</span>
            <span>{formatDate(row.date)}</span>
            <span className="truncate">{row.description}</span>
            <span>{row.accountCode}</span>
            <span>{row.accountName}</span>
            <span>{row.debit > 0 ? formatCurrency(row.debit) : '-'}</span>
            <span>{row.credit > 0 ? formatCurrency(row.credit) : '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MayorTable: React.FC<{ data?: LedgerAccountDetail; loading: boolean; accountId: string }> = ({ data, loading, accountId }) => {
  if (!accountId) return <p className="empty-text">Seleccione una cuenta imputable para ver su mayor.</p>;
  if (loading) return <p className="loading-text">Cargando...</p>;
  if (!data) return null;
  return (
    <>
      <div className="mayor-header">
        <h3>{data.account.code} - {data.account.name}</h3>
        <p>Naturaleza: {data.isDebitNature ? 'Deudora (Debe - Haber)' : 'Acreedora (Haber - Debe)'}</p>
        <p>Saldo final: <strong>{formatCurrency(data.finalBalance)}</strong></p>
      </div>
      {data.rows.length === 0 ? (
        <p className="empty-text">Sin movimientos para el período seleccionado.</p>
      ) : (
        <div className="treasury-table-wrapper">
          <div className="treasury-table">
            <div className="treasury-table-head">
              <span>Fecha</span>
              <span>Asiento</span>
              <span>Descripción</span>
              <span>Debe</span>
              <span>Haber</span>
              <span>Saldo</span>
            </div>
            {data.rows.map((row, i) => (
              <div key={i} className="treasury-table-row">
                <span>{formatDate(row.date)}</span>
                <span>{row.entryNumber}</span>
                <span className="truncate">{row.description}</span>
                <span>{row.debit > 0 ? formatCurrency(row.debit) : '-'}</span>
                <span>{row.credit > 0 ? formatCurrency(row.credit) : '-'}</span>
                <span>{formatCurrency(row.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const TrialBalanceTable: React.FC<{ data?: TrialBalanceData; loading: boolean }> = ({ data, loading }) => {
  if (loading) return <p className="loading-text">Cargando...</p>;
  if (!data || data.rows.length === 0) return <p className="empty-text">Sin datos para el período seleccionado.</p>;
  return (
    <div className="treasury-table-wrapper">
      <div className="treasury-table">
        <div className="treasury-table-head">
          <span>Código</span>
          <span>Cuenta</span>
          <span>Débitos</span>
          <span>Créditos</span>
          <span>Saldo Deudor</span>
          <span>Saldo Acreedor</span>
        </div>
        {data.rows.map((row, i) => (
          <div key={i} className="treasury-table-row">
            <span>{row.code}</span>
            <span>{row.name}</span>
            <span>{formatCurrency(row.totalDebit)}</span>
            <span>{formatCurrency(row.totalCredit)}</span>
            <span>{row.debitBalance > 0 ? formatCurrency(row.debitBalance) : '-'}</span>
            <span>{row.creditBalance > 0 ? formatCurrency(row.creditBalance) : '-'}</span>
          </div>
        ))}
        <div className="treasury-table-row totals-row">
          <span>TOTALES</span>
          <span />
          <span>{formatCurrency(data.totals.totalDebit)}</span>
          <span>{formatCurrency(data.totals.totalCredit)}</span>
          <span>{formatCurrency(data.totals.debitBalance)}</span>
          <span>{formatCurrency(data.totals.creditBalance)}</span>
        </div>
      </div>
    </div>
  );
};

const IncomeStatementView: React.FC<{ data?: IncomeStatementData; loading: boolean }> = ({ data, loading }) => {
  if (loading) return <p className="loading-text">Cargando...</p>;
  if (!data) return null;
  return (
    <div className="income-statement">
      <div className="is-section">
        <h3 className="is-title">Ingresos</h3>
        {data.revenueRows.length === 0 ? (
          <p className="empty-text">Sin ingresos en el período.</p>
        ) : (
          <div className="treasury-table" style={{ marginTop: '8px' }}>
            <div className="treasury-table-head">
              <span>Código</span>
              <span>Cuenta</span>
              <span>Importe</span>
            </div>
            {data.revenueRows.map((row, i) => (
              <div key={i} className="treasury-table-row">
                <span>{row.code}</span>
                <span>{row.name}</span>
                <span>{formatCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="is-total">Total Ingresos: <strong>{formatCurrency(data.totalRevenue)}</strong></div>
      </div>

      <div className="is-section">
        <h3 className="is-title">Gastos</h3>
        {data.expenseRows.length === 0 ? (
          <p className="empty-text">Sin gastos en el período.</p>
        ) : (
          <div className="treasury-table" style={{ marginTop: '8px' }}>
            <div className="treasury-table-head">
              <span>Código</span>
              <span>Cuenta</span>
              <span>Importe</span>
            </div>
            {data.expenseRows.map((row, i) => (
              <div key={i} className="treasury-table-row">
                <span>{row.code}</span>
                <span>{row.name}</span>
                <span>{formatCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="is-total">Total Gastos: <strong>{formatCurrency(data.totalExpense)}</strong></div>
      </div>

      <div className="is-section is-result">
        <h3 className="is-title">Resultado Neto</h3>
        <span className={`is-result-value ${data.netResult >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatCurrency(data.netResult)}
        </span>
      </div>
    </div>
  );
};

const AvailabilitiesView: React.FC<{ data?: AvailabilityData; loading: boolean }> = ({ data, loading }) => {
  if (loading) return <p className="loading-text">Cargando...</p>;
  if (!data) return null;
  return (
    <div>
      <div className="treasury-table-wrapper">
        <div className="treasury-table">
          <div className="treasury-table-head">
            <span>Código</span>
            <span>Cuenta</span>
            <span>Saldo</span>
          </div>
          {data.accounts.map((row, i) => (
            <div key={i} className="treasury-table-row">
              <span>{row.code}</span>
              <span>{row.name}</span>
              <span>{formatCurrency(row.balance)}</span>
            </div>
          ))}
          <div className="treasury-table-row totals-row">
            <span />
            <span>Total Disponibilidades</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

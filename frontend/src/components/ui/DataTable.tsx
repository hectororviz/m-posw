import './ui.css';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  /** Columnas secondary con priority="low" se ocultan en pantallas angostas (<900px). */
  priority?: 'high' | 'low';
  render?: (row: T) => React.ReactNode;
  value?: (row: T) => React.ReactNode;
}

function cellClass<T>(c: Column<T>): string {
  const cls = [
    c.numeric || c.align === 'right' ? 'num' : '',
    c.align === 'center' ? 'center' : '',
    c.priority === 'low' ? 'col-low' : '',
  ].filter(Boolean).join(' ');
  return cls;
}

export interface EmptyState {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function DataTable<T extends object>({ columns, rows, emptyState, density = 'default', loading, error, onRetry }: {
  columns: Column<T>[]; rows: T[]; emptyState?: EmptyState; density?: 'default' | 'compact'; loading?: boolean;
  error?: string | null; onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="ui-table-wrap">
        <div className="ui-error" role="alert">
          <p>No se pudo cargar la lista: {error}</p>
          {onRetry ? <button type="button" className="ui-btn ui-btn--secondary" onClick={onRetry}>Reintentar</button> : null}
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="ui-table-wrap" aria-busy="true">
        <div style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
          {[0, 1, 2].map((i) => <div key={i} className="ui-skeleton-row" />)}
        </div>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="ui-table-wrap">
        <div className="ui-empty">
          {emptyState?.icon}
          <h3>{emptyState?.title ?? 'Sin datos'}</h3>
          {emptyState?.hint ? <p>{emptyState.hint}</p> : null}
          {emptyState?.actionLabel && emptyState?.onAction ? (
            <button type="button" className="ui-btn ui-btn--primary" onClick={emptyState.onAction}>{emptyState.actionLabel}</button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="ui-table-wrap">
      <table className={`ui-table ui-table--${density}`}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={cellClass(c)}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} title={typeof (c.value?.(r) ?? '') === 'string' ? String(c.value?.(r)) : undefined} className={cellClass(c)}>
                  {c.render ? c.render(r) : c.value?.(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

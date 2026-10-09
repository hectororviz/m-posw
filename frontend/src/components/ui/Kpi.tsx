import './ui.css';

export type KpiTone = 'default' | 'success' | 'warning' | 'danger';

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="ui-kpi-grid">{children}</div>;
}

export function KpiCard({ label, value, sub, tone = 'default', icon, loading }: { label: string; value: string; sub?: string; tone?: KpiTone; icon?: React.ReactNode; loading?: boolean }) {
  if (loading) {
    return (
      <div className={`ui-kpi ui-kpi--${tone}`} aria-busy="true">
        <div style={{ display: 'grid', gap: 'var(--space-2)', width: '100%' }}>
          <div className="ui-skeleton-line" style={{ width: '60%' }} />
          <div className="ui-skeleton-line ui-skeleton-line--lg" style={{ width: '40%' }} />
        </div>
      </div>
    );
  }
  return (
    <div className={`ui-kpi ui-kpi--${tone}`}>
      <div>
        <p className="ui-kpi__label">{label}</p>
        <p className="ui-kpi__value">{value}</p>
        {sub ? <p className="ui-kpi__sub">{sub}</p> : null}
      </div>
      {icon ? <div className="ui-kpi__icon">{icon}</div> : null}
    </div>
  );
}

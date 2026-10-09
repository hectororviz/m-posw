import './ui.css';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

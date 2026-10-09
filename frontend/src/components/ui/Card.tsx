import { formatPercent } from '../../utils/format';
import './ui.css';

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return <section className="ui-card">{title ? <h3>{title}</h3> : null}{children}</section>;
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="ui-toolbar">{children}</div>;
}

export function ListError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="ui-error" role="alert">
      <p>{message ? `No se pudo cargar la lista: ${message}` : 'No se pudo cargar la lista.'}</p>
      {onRetry ? <button type="button" className="ui-btn ui-btn--secondary" onClick={onRetry}>Reintentar</button> : null}
    </div>
  );
}

export function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
  const tone = value > 0 ? 'var(--color-success)' : value < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';
  void suffix;
  const text = `${arrow} ${formatPercent(Math.abs(value))}`;
  return <span style={{ color: tone, font: 'var(--text-caption)' }}>{text}</span>;
}

import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

export function Button({ variant = 'secondary', busy, children, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button {...rest} disabled={disabled || busy} className={`ui-btn ui-btn--${variant} ${rest.className ?? ''}`}>
      {busy && <span className="ui-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Fab({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`ui-fab ${rest.className ?? ''}`} aria-label={rest['aria-label'] ?? 'Crear'}>{children ?? '+'}</button>;
}

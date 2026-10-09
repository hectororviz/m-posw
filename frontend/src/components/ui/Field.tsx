import './ui.css';

export function FormGrid({ children, cols = 1 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return <div className={`ui-form-grid${cols === 2 ? ' ui-form-grid--2' : ''}`}>{children}</div>;
}

export function FormField({ label, required, optional, hint, error, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="ui-field">
      <label>{label} {required ? <span className="req">*</span> : null}{optional ? ' (opcional)' : null}</label>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return <input {...rest} className={`ui-input${error ? ' ui-input--err' : ''} ${className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return <select {...rest} className={`ui-select${error ? ' ui-select--err' : ''} ${className ?? ''}`} />;
}

export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return <input type="date" {...rest} className={`ui-input${error ? ' ui-input--err' : ''} ${className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`ui-textarea ${props.className ?? ''}`} />;
}

export function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { error, className, ...rest } = props;
  return (
    <span className="ui-money">
      <span>$</span>
      <input inputMode="decimal" {...rest} className={`ui-input${error ? ' ui-input--err' : ''} ${className ?? ''}`} />
    </span>
  );
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="ui-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input {...props} className={`ui-input ${props.className ?? ''}`} />
    </span>
  );
}

const ICON_PRESETS = [
  '🍔', '🍕', '🌭', '🥪', '🍟', '🌮', '🥙', '🍝', '🥩', '🍗',
  '🍳', '🥞', '🥐', '🍞', '🧀', '🥗', '🍿', '🥜', '🍫', '🍩',
  '🍰', '🍪', '🍦', '🧁', '🥧', '🎂', '🍬', '🍭', '🍎', '🍊',
  '🍋', '🍌', '🍉', '🍇', '🍓', '🍍', '🥥', '🍅', '🥑', '🌽',
  '☕', '🧉', '🥤', '🍺', '🍷', '💧', '🧃', '🫖', '🥛', '🍾',
  '🍽️', '🥂', '⭐', '❤️', '🎉', '⚽', '🏆', '🎵', '📦', '🧾',
];

export function IconPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="ui-icon-picker">
      <div className="ui-icon-grid" role="listbox" aria-label="Íconos predefinidos">
        {ICON_PRESETS.map((icon) => (
          <button
            key={icon}
            type="button"
            role="option"
            aria-selected={value === icon}
            title={icon}
            className={`ui-icon-option${value === icon ? ' selected' : ''}`}
            onClick={() => onChange(icon)}
          >
            {icon}
          </button>
        ))}
      </div>
      <input
        id={id}
        type="text"
        className="ui-input"
        placeholder="O escribí uno propio ✍️"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SegmentedControl({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ui-segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

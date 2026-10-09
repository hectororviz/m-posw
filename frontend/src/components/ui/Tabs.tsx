import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ui.css';

export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: React.ReactNode }[]; value: string; onChange: (v: string) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].value);
  };
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Tabs ligados a rutas: un solo componente para layouts con sub-navegación. */
export function RouteTabs({ tabs }: { tabs: { value: string; label: React.ReactNode; to: string }[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = [...tabs]
    .sort((a, b) => b.to.length - a.to.length)
    .find((t) => location.pathname === t.to || location.pathname.startsWith(`${t.to}/`)) ?? tabs[0];
  return <Tabs tabs={tabs} value={current.value} onChange={(v) => navigate(tabs.find((t) => t.value === v)?.to ?? v)} />;
}

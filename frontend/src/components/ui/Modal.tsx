import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import './ui.css';

export function Modal({ title, onClose, children, footer, size = 'sm', dirty }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg';
  /** Si hay cambios sin guardar, cerrar pide confirmación antes de salir. */
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) setShowDiscard(true);
    else onClose();
  }, [dirty, onClose]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { requestClose(); return; }
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [requestClose]);
  return (
    <div className="ui-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`ui-modal${size !== 'sm' ? ` ui-modal--${size}` : ''}`}>
        <div className="ui-modal__head">
          <h2>{title}</h2>
          <Button variant="icon" data-close onClick={requestClose} aria-label="Cerrar"><X size={16} /></Button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__foot">{footer}</div> : null}
      </div>
      {showDiscard && (
        <ConfirmDialog
          title="Descartar cambios"
          message="Tenés cambios sin guardar. ¿Salir igual?"
          confirmLabel="Descartar"
          onCancel={() => setShowDiscard(false)}
          onConfirm={onClose}
        />
      )}
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Eliminar', onConfirm, onCancel, busy }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} footer={<><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : confirmLabel}</Button></>}>
      <p style={{ font: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>{message}</p>
    </Modal>
  );
}

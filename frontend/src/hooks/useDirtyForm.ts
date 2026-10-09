import { useMemo, useRef } from 'react';

/** Compara el formulario actual con su valor inicial (serializado) para detectar cambios sin guardar. */
export function useDirtyForm<T>(current: T): { dirty: boolean; reset: (next: T) => void } {
  const initialRef = useRef<string>(JSON.stringify(current));
  const dirty = useMemo(() => JSON.stringify(current) !== initialRef.current, [current]);
  const reset = (next: T) => {
    initialRef.current = JSON.stringify(next);
  };
  return { dirty, reset };
}

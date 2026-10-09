// DESIGN.md §1.1 — acento: luminancia, on-primary y contraste.
export function luminanceOf(hex: string): number {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const toLin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function onPrimaryFor(hex: string): string {
  return luminanceOf(hex) > 0.5 ? '#0f172a' : '#ffffff';
}

function lumForContrast(hex: string): number {
  return luminanceOf(hex);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = lumForContrast(a);
  const l2 = lumForContrast(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function applyAccent(accent: string): void {
  const root = document.documentElement;
  const value = accent?.trim();
  if (!value) {
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--accent-color');
    root.style.setProperty('--color-on-primary', '#ffffff');
    root.style.setProperty('--color-primary-text', 'var(--color-primary)');
    return;
  }
  root.style.setProperty('--color-primary', value);
  root.style.setProperty('--accent-color', value);
  root.style.setProperty('--color-on-primary', onPrimaryFor(value));
  root.style.setProperty('--color-primary-contrast', onPrimaryFor(value));
  root.style.setProperty('--color-primary-text', value);
}

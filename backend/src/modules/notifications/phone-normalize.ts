/**
 * Normaliza un número de teléfono argentino a formato E.164.
 *
 * Formato esperado: 549 + código de área sin 0 + número sin 15.
 * Ejemplo: "011 15-1234-5678" → "5491112345678"
 */
export function normalizeArgentinaPhone(tel: string): string {
  let cleaned = tel.replace(/[^0-9]/g, '');

  if (!cleaned.startsWith('549')) {
    if (cleaned.startsWith('54')) {
      cleaned = '549' + cleaned.slice(2);
    } else if (cleaned.startsWith('9') && cleaned.length >= 11) {
      cleaned = '54' + cleaned;
    } else {
      cleaned = '549' + cleaned;
    }
  }

  if (cleaned.startsWith('549') && cleaned.length > 13) {
    cleaned = cleaned.slice(0, 13);
  }

  return cleaned;
}

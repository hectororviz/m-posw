export const DEFAULT_WEB_MESSAGE = 'Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días).';

export const normalizePhoneForWa = (phone: string): string => {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned.startsWith('549')) {
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (cleaned.startsWith('15')) cleaned = cleaned.slice(2);
    cleaned = '549' + cleaned;
  }
  return cleaned;
};

export const buildWhatsAppWebLink = (params: {
  nombre: string;
  telefono: string;
  saldo?: number | null;
  diasSinPagar?: number | null;
  template?: string | null;
  club?: string | null;
}): string => {
  const saldo = (params.saldo ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const dias = String(params.diasSinPagar ?? 0);
  const clubName = params.club || 'nuestro club';
  const message = (params.template || DEFAULT_WEB_MESSAGE)
    .replace(/{{nombre}}/g, params.nombre)
    .replace(/{{saldo}}/g, saldo)
    .replace(/{{dias}}/g, dias)
    .replace(/{{club}}/g, clubName);
  const phone = normalizePhoneForWa(params.telefono || '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

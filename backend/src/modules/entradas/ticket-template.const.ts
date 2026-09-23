export const TICKET_WIDTH_COLS = 32;

export const DEFAULT_TICKET_LAYOUT = {
  version: 1,
  widthCols: TICKET_WIDTH_COLS,
  elements: [
    { type: 'logo', value: '{{escudo}}', align: 'center', enabled: true },
    { type: 'text', value: '{{club}}', size: 'L', align: 'center', bold: true, enabled: true },
    { type: 'text', value: '{{torneo}} vs {{rival}}', size: 'M', align: 'center', enabled: true },
    { type: 'text', value: '{{fecha}}  {{sector}}', size: 'M', align: 'center', enabled: true },
    { type: 'line', enabled: true },
    { type: 'text', value: '{{codigo}}', size: 'XL', align: 'center', bold: true, enabled: true },
    { type: 'qr', value: '{{codigo}}', align: 'center', enabled: true },
    { type: 'text', value: '${{precioUnit}} x{{cantidad}} = ${{total}}', size: 'M', align: 'center', enabled: true },
    { type: 'text', value: '{{footer}}', size: 'S', align: 'center', enabled: true },
    { type: 'qr', value: '{{benefitQr}}', align: 'center', enabled: false },
    { type: 'text', value: '{{beneficioNombre}} {{beneficioPorcentaje}}', size: 'M', align: 'center', bold: true, enabled: false },
  ],
};

export const TICKET_VARIABLES = [
  'club',
  'torneo',
  'rival',
  'fecha',
  'sector',
  'codigo',
  'codigos',
  'precioUnit',
  'cantidad',
  'total',
  'descuento',
  'subtotal',
  'ventaId',
  'fechaPago',
  'footer',
  'escudo',
  'benefitQr',
  'beneficioNombre',
  'beneficioPorcentaje',
];

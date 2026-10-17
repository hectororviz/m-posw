-- Siembra el template del ticket de eventos especiales.
-- Evita la race del lazy-create cuando varias terminales lo piden a la vez
-- (una recibe 500 por clave duplicada y se queda sin escudo por el orden del sync).
INSERT INTO "EntradaTicketTemplate" ("id", "version", "widthCols", "layout", "updatedAt")
VALUES (
  'evento',
  1,
  32,
  '{"version":1,"widthCols":32,"elements":[{"type":"logo","value":"{{escudo}}","align":"center","enabled":true},{"type":"text","value":"{{club}}","size":"L","align":"center","bold":true,"enabled":true},{"type":"text","value":"{{evento}}","size":"M","align":"center","bold":true,"enabled":true},{"type":"text","value":"{{fecha}}","size":"M","align":"center","enabled":true},{"type":"line","enabled":true},{"type":"text","value":"{{codigo}}","size":"XL","align":"center","bold":true,"enabled":true},{"type":"qr","value":"{{codigo}}","align":"center","enabled":true},{"type":"text","value":"${{precioUnit}} x{{cantidad}} = ${{total}}","size":"M","align":"center","enabled":true},{"type":"text","value":"{{footer}}","size":"S","align":"center","enabled":true},{"type":"qr","value":"{{benefitQr}}","align":"center","enabled":false},{"type":"text","value":"{{beneficioNombre}} {{beneficioPorcentaje}}","size":"M","align":"center","bold":true,"enabled":false}]}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

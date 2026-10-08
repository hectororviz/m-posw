# TODO — m-POSw

Lista de pendientes no urgentes. Marcar con `[x]` al completar.

## Terminal Android (`m_posw_entradas`, APK única Entradas/POS)
- [ ] **Responsive para tablets**: layouts `sw600dp` (grilla por ancho de
      pantalla, no por escala S/M/L), topes de ancho en sheets/diálogos y
      tamaños adecuados a 10". Hoy funciona pero ralo (diseñado para
      Sunmi V2s 5.5").
- [ ] **Abstracción de impresión**: interfaz `PrinterBackend` con dos
      implementaciones (Sunmi AIDL integrado vs ESC/POS por Bluetooth a
      impresora externa). Hoy atado a Sunmi: sin su servicio la venta igual
      se aprueba y queda guardada para reimprimir.
- [ ] Tras cada release: verificar en equipo el sello de versión en Config
      (`vX.Y.Z (sha)`) antes de reportar bugs.

## Backoffice / general
- [ ] (reservado para pendientes del front principal)

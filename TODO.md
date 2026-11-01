# TODO — m-POSw

Lista de pendientes no urgentes. Marcar con `[x]` al completar.

## Terminal Android (`m_posw_entradas`, APK única Entradas/POS)
- [x] **Responsive para tablets**: layouts `sw600dp`/`sw600dp-land`, grilla de
      tamaño fijo por escala S/M/L (solo cambia la cantidad por fila), carrito
      lateral colapsable en apaisada, topes de ancho en sheets/diálogos y
      contenido centrado (Entradas, Config).
- [x] **Abstracción de impresión**: `PrinterRouter` automático (Sunmi AIDL
      integrado vs ESC/POS por Bluetooth a impresora externa 58mm, con gestión
      BT en Config). Sin impresora la venta igual se aprueba y queda guardada
      para reimprimir.
- [ ] Tras cada release: verificar en equipo el sello de versión en Config
      (`vX.Y.Z (sha)`) antes de reportar bugs.

## Backoffice / general
- [ ] (reservado para pendientes del front principal)
- [ ] **Módulo de contabilidad**: revisar cómo encarar la Tesorería/Auditoría MP
      (no conforma el diseño actual). Mientras tanto el cron del reporte de
      gastos/liberaciones de MP (`cronReleaseSync`, cada 6 h) quedó desactivado
      con `Setting.releaseReportEnabled=false` en las instancias **Noe7** y
      **soler** (2026-10-10). El cron sigue registrado pero corta antes de salir
      a pedir el reporte. Reactivar = volver el flag a `true` en cada DB.
      Contexto: `backend/src/modules/mp-auditoria/mp-auditoria.service.ts:527`.

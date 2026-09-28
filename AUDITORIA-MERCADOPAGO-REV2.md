# Auditoría de Integración Mercado Pago — m-POSw (Revisión 2)

Fecha: 2026-09-28. Alcance: `backend/src/modules/{sales,payments,common/mp-config,mercadopago-oauth,entradas}`,
`frontend/src/pages/{CheckoutQrPage,AdminSalesPage}`, `backend/prisma/schema.prisma`, `.env.example`,
`backend/package.json`. Rama auditada: `main` post-merge Fases 0–6b + fixes post-deploy.
Método: lectura directa de fuente (grafo de código no disponible en esta sesión; sin claims de exhaustividad
estructural). Evidencia viva: instancia prod `soler` (OAuth `linked:true`, `env:live`), ventas QR #1803–#1805
aprobadas el día de la auditoría, 0 `PENDING` QR restantes.
Veredicto: **APROBABLE con observaciones menores (ningún bloqueante)**.

## 1. Resumen ejecutivo

La integración vende por QR Instore (web + POS externo Entradas) y transferencia CVU, confirma por webhook
+ polling de respaldo, concilia reembolsos/contracargos y opera 100% con OAuth (sin tokens en `.env` en prod).
Respecto de la Rev.1 (2026-09-23, "no aprobable"): se cerraron los 2 bloqueantes (firma desactivable,
falta de idempotencia/SDK) y los 3 altos (reembolsos, test/live, polling frágil), todo verificado en
producción real. Quedan 5 observaciones medias/bajas, ninguna impide operar ni homologar. Nota: la API
formal de homologación de MP responde `Product not homologable` para Instore QR en las 3 apps de la cuenta,
por lo que esta aprobación es de calidad interna + evidencia operativa.

## 2. Flujo completo detectado

### 2.1 Creación de orden QR Instore
`sales/services/mercadopago-instore.service.ts` (`createOrUpdateOrder`, `putTicketOrder`): `PUT
/instore/qr/seller/collectors/{id}/stores/{s}/pos/{p}/orders` con `external_reference = sale-<uuid>` o
`ticket-<id>`, `notification_url=https://<subdominio>.mposw.com.ar/api/webhooks/mercadopago` por orden
(`getNotificationUrl`, también en `internet-vouchers/internet-public.service.ts:283`). Cada intento genera
`X-Idempotency-Key = <external_reference>:<uuid>` (`:49-67`, `:124-128`); `request()` (`:353-~530`)
reintenta 3 veces `500/1500/3000ms+jitter` solo en `429/5xx/timeout/red` (4xx fail-fast), timeout 15s por
intento con `AbortController` fresco. `getPayment()` usa SDK `Payment` con fallback a `fetch`.
Límite conocido v1: MP admite una sola orden activa por POS (la terminal Entradas usa POS dedicado).

### 2.2 Confirmación por webhook (doble formato)
`sales/webhooks/mercadopago-webhook.controller.ts:28-88`: responde `200` inmediato y procesa en
`setImmediate`. Formato nuevo (`?data.id=&type=`, Webhooks v2) → HMAC-SHA256 estricto siempre en prod,
tolerancia `ts` 300s, sin secret en prod → fail-closed (`:177-236`). Formato viejo (`?id=&topic=`,
`user-agent: MercadoPago Feed v2.0`) → HMAC no reproducible con el secret del panel (16 variantes de
manifest × 2 codificaciones de clave probadas contra firmas reales, 0 match) → fallback
`verifyFeedViaMpApi` (`:90-169`): consulta el pago/orden a la API (canal confiable OAuth) y solo acepta si
está aprobado y su `external_reference` es propio (`sale-`/`ticket-`); si no, 401. Verificado en prod:
`WEBHOOK_FEED_VERIFIED_VIA_API` → ventas #1804/#1805 aprobadas en segundos.
`sales/services/mercadopago-webhook-processor.service.ts`: idempotencia por `PaymentEvent` unique,
mapeo real de estados, `updateMany` condicional anti-doble-finalize, stock atómico, vouchers, aviso socket.
Reintentos de merchant_order sin pago + cola persistente `WebhookRetry` (backoff `5s→30m`, 5 intentos →
`DEAD` revisión manual) + cron cada minuto.

### 2.3 Transferencia CVU (sin webhook, por diseño)
`payments/payments.service.ts:42-116`: polling con cursor persistido `Setting.lastMpPollAt` + solape 3 min
(incidente 2026-09-28: sin solape, un pago aprobado segundos después del borde quedaba invisible),
paginación `50×3`, filtro `cvu | money_transfer`, dedup memoria + `movimientoMP`. `confirmTransfer`
reserva `movimientoMP{procesado:false}` ANTES de crear la venta (`P2002` → devuelve existente o `409`).

### 2.4 Reembolsos y contracargos
`POST /sales/:id/refund` (`sales.controller.ts:119-125`, `VENTAS FULL` + check `ADMIN` en servicio):
SDK `PaymentRefund.create({payment_id, requestOptions:{idempotencyKey:'refund:<saleId>'}})` (total),
transacción a `REFUNDED/REJECTED/refundedAt` + auditoría en `mpRaw`, reversión de stock atómica y
desactivación de vouchers. Webhook mapea `refunded→REFUNDED`, `charged_back→CHARGEBACK`
(`mercadopago-webhook.utils.ts:275-283`); `mapSaleStatus` los lleva a `REJECTED` (reportes intactos).
Botón en Detalle de venta solo `ADMIN` + badges. Limitación v1 documentada: reembolsos desde el panel
de MP no revierten stock/vouchers.

### 2.5 Configuración y credenciales
`common/mp-config.service.ts`: OAuth en DB primero (renovación a 5 min + cron 6h), fallback
`MP_TEST_/MP_LIVE_/MP_ACCESS_TOKEN` según `MP_ENV` (inferido por prefijo); guard fail-fast
`live+TEST-`. `GET /mp-oauth/status` expone `env/isTest/tokenSource`. Prod: `tokenSource:oauth`.
`MP_WEBHOOK_SECRET(_LIVE|_TEST)` para firma; scripts `~/srv/mposw/make_instancia.sh` inyectan el secret
compartido del panel (antes generaban uno aleatorio por instancia: causa raíz del incidente #1803).

## 3. Hallazgos por severidad (solo abiertos; lo cerrado está en §5 y bitácora §10)

### M1 — Fallback Feed sin rate-limit dedicado (Media)
Ubicación: `mercadopago-webhook.controller.ts:17` (`@SkipThrottle`) + `verifyFeedViaMpApi` (`:90-169`).
Evidencia: cada webhook Feed con HMAC inválido dispara 1–2 llamadas a la API de MP antes del 401.
No permite fraude (exige pago aprobado + `external_reference` propio), pero un atacante puede quemar
cuota de API. Sugerencia: throttle solo a esa rama o contador de `API_VERIFY_FAILED` por IP con bloqueo
temporal. Diff orientativo:
```diff
- if (!signatureResult.isValid && signatureResult.shouldReject) {
-   if (await this.verifyFeedViaMpApi({ topic, body, query, resourceId })) {
+ if (!signatureResult.isValid && signatureResult.shouldReject) {
+   this.feedAttempts.record(clientIp); // ventana deslizante, p.ej. 30/min
+   if (this.feedAttempts.allowed(clientIp) &&
+       await this.verifyFeedViaMpApi({ topic, body, query, resourceId })) {
```

### M2 — Sin vista admin de `WebhookRetry.DEAD` (Media)
Ubicación: `mercadopago-webhook-processor.service.ts` (`processDueRetries`, `DEAD` = revisión manual).
Evidencia: los fallidos tras 5 intentos solo existen en DB + logs. Sugerencia: solapa de solo lectura
en Tesorería/Ventas (`GET /webhooks/retries?status=DEAD`) con botón "reintentar" (resetea a `PENDING`).

### M3 — Filtro de transferencias no cubre `account_money` no-`money_transfer` (Media-baja)
Ubicación: `payments/payments.service.ts:63-65`. Evidencia: el pago real observado era
`account_money`/`money_transfer` (matchea), pero una transferencia que llegue como `account_money` +
`regular_payment` se ignora en silencio. Sugerencia: loguear `Found transfer payment` ya existe; agregar
métrica de descartados por filtro o ampliar a `bank_transfer` previa validación contra docs de
`payment_method_id`/`operation_type`.

### B1 — Una sola orden QR activa por POS limita concurrencia (Baja, conocido v1)
Ubicación: `mercadopago-instore.service.ts` + `Setting.mpEntradas*`. Con N terminales concurrentes se
necesita 1 POS MP por terminal. Documentado; sin cambio propuesto.

### B2 — JWT en `localStorage` (Baja para MP, heredado de auditoría de seguridad)
Ubicación: `frontend/src/api/client.ts`, `AuthContext.tsx`. Fuera del alcance MP/PCI (no hay PAN),
pero mantiene exposición a XSS. Mitigado parcialmente con CSP/helmet; migración a `httpOnly` queda
como deuda conocida.

## 4. Plan de remediación priorizado

1. Semana 1: M1 (throttle rama Feed) + M2 (vista DEAD) — ambos sin downtime, solo backend.
2. Semana 2: M3 (revisar cobertura de métodos con 30 días de `payment_method_id` reales) + ventana
   TEST (`MP_ENV=test`, QR + transferencia + reembolso) → `quality_evaluation` + `form submit` (prod.33).
3. Cuando aplique: rotación anual del webhook secret (panel → `.env` de cada instancia + `make_instancia.sh`).

## 5. Checklist de calidad

| Criterio | Estado | Detalle |
|---|---|---|
| SDK oficial | Cumple parcial | `mercadopago@3.6.1` para `Payment`/`PaymentRefund`; PUT/DELETE Instore por `fetch` (el SDK no expone ese endpoint) con idempotencia + retry |
| Credenciales test/prod | Cumple | `MP_ENV` + tokens separados + guard `live+TEST-`; prod corre OAuth (`tokenSource:oauth`) |
| Idempotencia en creación | Cumple | `X-Idempotency-Key` por intento + PUT idempotente por URL |
| Idempotencia webhook | Cumple | `PaymentEvent` unique + reserva `movimientoMP` + `updateMany` condicional |
| Firma webhook | Cumple | Estricta en prod, `ts` 300s, fail-closed; Feed legacy con verificación API documentada |
| Estados de pago | Cumple | `REFUNDED`/`CHARGEBACK` reales de punta a punta |
| Reembolsos | Cumple | SDK total solo ADMIN con reversión; parciales fuera de alcance por diseño |
| Errores y reintentos | Cumple | Retry con jitter + cola DB `5s→30m` + `DEAD` (falta UI: M2) |
| Seguridad y PCI | Cumple | Sin PAN en servidor; logs recortados; secretos fuera del repo |
| Experiencia de cobro | Cumple | UX `IN_PROCESS`/`EXPIRED`/`REFUNDED`/`CHARGEBACK` + Reintentar; cleanup >15min; approve-antes-de-expirar |
| OAuth y renovación | Cumple | Umbral 5 min + cron; verificado `expiresAt` vigente en prod |
| Observabilidad | Cumple parcial | Correlación `requestId` total; falta alerta ante racha de `INVALID`/`DEAD` |

## 7. Resolución M1+M2+M3 (2026-09-28, rama `fix/mp-hallazgos-menores`, merge a `main`, desplegado en soler)

- M1: sliding-window en memoria (30/min por IP, solo rama Feed) + `WEBHOOK_FEED_THROTTLED`; `@SkipThrottle` de clase intacto. Tests 23/23.
- M2: `GET/POST /webhooks/retries[/:id/retry]` (VENTAS FULL + ADMIN) + tab "Reintentos" en `AdminSalesPage` con badge DEAD y reintento en 1 click. Verificado en prod: `200 {"total":0}`.
- M3: log `TRANSFER_FILTERED_OUT` con dedup para medir 30 días; filtro sin cambios.
- B1: confirmado N/A (Entradas usa POS MP dedicado). B2: diferido; el usuario fortalece contraseñas por su lado.
- Verificación: build back+front ok, 31 tests back, frontend sirve bundle nuevo.

## 6. Referencias

* Webhooks y firma `x-signature`: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
* QR Instore órdenes: https://www.mercadopago.com.ar/developers/es/docs/instore-qrcode/qr-order
* SDK Node e idempotencia: https://www.mercadopago.com.ar/developers/es/docs/sdks-library/server-side/node
* Búsqueda de pagos: https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_search/get
* Reembolsos: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/refunds
* OAuth y renovación: https://www.mercadopago.com.ar/developers/es/docs/security/oauth
* Homologación: https://www.mercadopago.com.ar/developers/es/docs/getting-started/homologation
* SDK Node (validador webhook): https://github.com/mercadopago/sdk-nodejs

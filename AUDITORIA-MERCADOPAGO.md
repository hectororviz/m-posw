# Auditoría de Integración Mercado Pago — m-POSw

Fecha: 2026-09-23
Alcance: `backend/src/modules/sales`, `backend/src/modules/payments`, `backend/src/modules/common/mp-config.service.ts`, `backend/src/modules/mercadopago-oauth`, `backend/src/modules/entradas`
Método: revisión de grafo + lectura directa de fuente. Cobertura verificada sin brechas en 7 archivos núcleo.
Veredicto: no aprobable aún. Hay 2 bloqueantes críticos + 3 altos que impiden homologación.

## 1. Resumen ejecutivo

La integración vende por QR Instore y por transferencia CVU, con OAuth funcional y renovación automática. Eso es una buena base. Sin embargo no usa SDK oficial, no separa credenciales de prueba y producción, permite webhooks sin firma válida y no gestiona reembolsos. Con esos huecos Mercado Pago rechaza la homologación y el negocio queda expuesto a cobros falsificados, dobles cobros y descuadres contables.

Para aprobar hay que: forzar firma de webhook, agregar idempotencia en creación, migrar a SDK oficial, separar prueba y producción, implementar reembolsos y endurecer el polling de transferencias.

## 2. Flujo completo detectado

### 2.1 Creación de orden QR Instore
Archivo: `backend/src/modules/sales/services/mercadopago-instore.service.ts:46-64`
Entradas web y de terminal POS externo crean `TicketSale` o `Sale` con `external_reference = sale-<uuid>` o `ticket-<id>`. Luego hace `PUT https://api.mercadopago.com/.../instore/orders/qr/.../orders` con `total_amount`, `items`, `notification_url`.
Cliente HTTP: `fetch` directo en `request():332-463`, con `Authorization: Bearer <token>` y `X-Integrator-Id` opcional. Tiempo de espera 15 segundos. Sin SDK `mercadopago` en `backend/package.json`.

Qué implica: al no usar SDK se pierden reintentos, tipado y cambios de API gestionados por Mercado Pago. Cada fallo de red o timeout queda a mano.

### 2.2 Confirmación por webhook QR
Archivo: `backend/src/modules/sales/webhooks/mercadopago-webhook.controller.ts:10-140`
Recibe `POST /webhooks/mercadopago`, extrae `resourceId`, verifica firma, responde `200 {ok:true}` de inmediato y procesa en `setImmediate`.
Archivo: `backend/src/modules/sales/services/mercadopago-webhook-processor.service.ts:235-367`
Busca el pago con `mpQueryService.getPayment()`, deriva `ticket-` hacia entradas o `sale-` hacia ventas, mapea estado con `mapMpPaymentToPaymentStatus()`, actualiza `Sale`, descuenta stock, genera vouchers de internet y avisa por websocket.

Qué implica: responder 200 antes de procesar es correcto, pero si el proceso falla sin cola persistente el pago queda como no acreditado aunque el cliente ya pagó.

### 2.3 Transferencia CVU o alias (sin webhook)
Archivo: `backend/src/modules/payments/payments.service.ts:41-147`
Hace polling a `GET /v1/payments/search?status=approved` de los últimos 2 minutos, filtra `payment_method_id=cvu` o `operation_type=money_transfer`, evita duplicados con `seenPaymentIds` en memoria y con tabla `movimientoMP`.
Confirmación en `confirmTransfer():149-278`: valida total contra items y descuentos de socio, crea `Sale APPROVED` + `movimientoMP` en transacción, descuenta stock y genera vouchers.

Qué implica: no depende de webhook, útil para interior. Pero la ventana de 2 minutos y la memoria volátil hacen que se pierdan pagos si el servidor reinicia o si hay más de 10 pagos.

### 2.4 Cancelación y reembolsos
Archivo: `backend/src/modules/sales/services/mercadopago-instore.service.ts:127-135` y `backend/src/modules/sales/sales.service.ts:403-429`
Solo existe borrado de orden QR pendiente (`DELETE order`). No existe `POST /v1/payments/:id/refunds`, ni estados `REFUNDED` o `CHARGEBACK` en base.

Qué implica: ante devolución hay que hacerlo manual en el panel de Mercado Pago, sin trazabilidad en el sistema. La contabilidad queda descuadrada.

### 2.5 Configuración y credenciales
Archivo: `backend/src/modules/common/mp-config.service.ts:24-62`
Lee token OAuth de tabla `Setting` (`mpLinked`, `mpAccessToken`, `mpRefreshToken`, `mpTokenExpiresAt`), renueva si vence en menos de 5 minutos vía `callRefreshApi():115-182`, si no usa `MP_ACCESS_TOKEN` de `.env`. Cron `tryRefreshToken():85-113` renueva cada 24 horas. OAuth completo en `mercadopago-oauth.service.ts:69-863` con detección y creación de tienda y caja.

Qué implica: el flujo OAuth es lo mejor de la integración. El problema es que hay un solo token de entorno, sin distinción prueba y producción.

## 3. Hallazgos críticos

### C1 — Firma de webhook desactivable
Ubicación: `backend/src/modules/sales/webhooks/mercadopago-webhook.controller.ts:73-128`
Evidencia: si no hay `MP_WEBHOOK_SECRET` acepta todo en no producción. En producción solo rechaza `payment + strict`. `merchant_order` nunca rechaza. `isStrictPaymentEnabled()` vale falso por defecto.
Qué implica: cualquiera puede enviar un webhook falso con un `payment_id` real o inventado y marcar ventas como pagadas. Es fraude directo y bloquea la homologación. También permite reintentos maliciosos y repetición de eventos.
Cómo solucionarlo:
1. Forzar modo estricto siempre en producción y rechazar 401 ante firma inválida.
2. Validar `x-signature` + `x-request-id` + `data.id` con `HMAC SHA256` y comparación segura.
3. Agregar tolerancia de 5 minutos al campo `ts` para frenar repetición.
4. Registrar `requestId` y no solo un recorte de 8 caracteres.
```diff
- private isStrictPaymentEnabled() { return raw === 'true'; }
+ private isStrictPaymentEnabled() { return true; }
+ if (!result.isValid) { response.status(401).json({ok:false}); return; }
+ const ts = Number(result.ts ?? 0);
+ if (Math.abs(Date.now()/1000 - ts) > 300) { response.status(401).json({ok:false}); return; }
```

### C2 — Sin SDK oficial y sin idempotencia en creación
Ubicación: `backend/src/modules/sales/services/mercadopago-instore.service.ts:332-463` y `backend/package.json:18-47`
Evidencia: no existe dependencia `mercadopago`. Todo es `fetch` manual. El `PUT` de orden no envía `X-Idempotency-Key`.
Qué implica: ante timeout o doble clic se crean dos órdenes o se cobra dos veces. Mercado Pago exige idempotencia para aprobar calidad. Sin SDK además se rompe fácil ante cambios de API.
Cómo solucionarlo:
1. Instalar SDK oficial.
2. Enviar llave única por venta e intento.
3. Reutilizar la misma llave en reintentos del mismo intento.
```bash
npm install mercadopago --save
```
```diff
+ import { MercadoPagoConfig, MerchantOrder } from 'mercadopago';
+ headers['X-Idempotency-Key'] = `${input.sale.id}:${attemptId}`;
+ // attemptId = uuid generado al iniciar el cobro, guardado en Sale.mpIdempotencyKey
```

## 4. Hallazgos altos

### H1 — Sin reembolsos ni contracargos
Ubicación: `backend/src/modules/sales/webhooks/mercadopago-webhook.utils.ts:254-288`
Evidencia: `refunded` y `charged_back` se mapean a `REJECTED`. No hay endpoint de reembolso.
Qué implica: se pierde la diferencia entre rechazo, devolución y contracargo. Tesorería no puede conciliar. El cliente devuelve y el stock no vuelve. La homologación pide flujo de devolución.
Cómo solucionarlo:
1. Crear enum `REFUNDED` y `CHARGEBACK` en `PaymentStatus` con migración Prisma.
2. Mapear cada estado a su valor real.
3. Crear servicio de reembolso y revertir stock y asientos.
```diff
- if (rejected||cancelled||refunded||charged_back) return REJECTED;
+ if (rejected||cancelled) return REJECTED;
+ if (refunded) return REFUNDED;
+ if (charged_back) return CHARGEBACK;
+ // + POST /sales/:id/refund -> POST https://api.mercadopago.com/v1/payments/:mpPaymentId/refunds
```

### H2 — Sin separación prueba y producción
Ubicación: `backend/src/modules/common/mp-config.service.ts:57-62`, `.env.example`
Evidencia: un solo `MP_ACCESS_TOKEN`. Sin `MP_TEST_*`, sin `MP_ENV`, sin validación de prefijo `TEST-` contra `APP_USR-`.
Qué implica: para probar se toca producción o se mezclan pagos reales con pruebas. No se puede presentar evidencia de homologación sin riesgo. Un token de prueba en producción deja de cobrar.
Cómo solucionarlo:
1. Agregar variables separadas y selector de entorno.
2. Bloquear arranque si en vivo hay token de prueba.
3. Mostrar entorno en el panel de configuración.
```diff
+ MP_ENV=test
+ MP_TEST_ACCESS_TOKEN=TEST-xxx
+ MP_LIVE_ACCESS_TOKEN=APP_USR-xxx
+ if (MP_ENV==='live' && token.startsWith('TEST-')) throw new Error('Token de prueba en producción');
```

### H3 — Polling de transferencias frágil
Ubicación: `backend/src/modules/payments/payments.service.ts:41-147`
Evidencia: ventana fija de 2 minutos, `limit 10`, `seenPaymentIds = new Set()` en memoria, sin cursor persistido.
Qué implica: si reinicia el backend se olvida lo visto y puede duplicar. Si hay más de 10 pagos o demora mayor a 2 minutos, el pago nunca aparece y el cliente pagó pero la venta no se crea.
Cómo solucionarlo:
1. Guardar `lastPollAt` en `Setting` o tabla propia.
2. Buscar desde ese cursor con paginación y reintento.
3. Verificar en base por `paymentId` antes de anunciar `hay_pago`.
```diff
- const beginDate = new Date(now.getTime() - 2*60*1000);
- if (this.seenPaymentIds.has(paymentId)) return false;
+ const beginDate = await this.getLastPollCursor(); // persistido
+ const existing = await prisma.movimientoMP.findUnique({where:{paymentId}});
+ if (existing?.procesado) return false;
```

## 5. Hallazgos medios

### M1 — Reintentos sin cola persistente
Ubicación: `backend/src/modules/sales/services/mercadopago-webhook-processor.service.ts:567-585` y `mercadopago-webhook.controller.ts:55-65`
Evidencia: `setImmediate` + `schedulePaymentRetries` simple. Responde 200 y si falla la base se pierde.
Qué implica: caídas breves de base o de Mercado Pago dejan ventas en pendiente para siempre.
Cómo solucionarlo: usar cola con reintentos exponenciales y fallidos a revisión manual.
```diff
- setImmediate(()=>processor.processWebhook({...}))
+ await webhookQueue.add('mp-webhook', {body,query,resourceId}, {attempts:5, backoff:{type:'exponential', delay:5000}});
```

### M2 — Idempotencia entrante parcial
Ubicación: `backend/src/modules/sales/services/mercadopago-webhook-processor.service.ts:537-553` y `payments.service.ts:149-278`
Evidencia: `PaymentEvent(provider,topic,resourceId)` único está bien para webhook, pero `confirmTransfer` hace `upsert` fuera de bloqueo total ante doble clic concurrente.
Qué implica: doble confirmación rápida puede crear dos ventas para el mismo `paymentId`.
Cómo solucionarlo: crear `movimientoMP` como reserva antes de crear la venta dentro de la misma transacción con `@@unique(paymentId)`.
```diff
+ await prisma.$transaction(async tx => {
+   await tx.movimientoMP.create({data:{paymentId, procesado:false}});
+   const sale = await tx.sale.create({...});
+   await tx.movimientoMP.update({where:{paymentId}, data:{saleId:sale.id, procesado:true}});
+ });
```

### M3 — Logs con datos sensibles
Ubicación: `mercadopago-webhook.controller.ts:26-35`, `mercadopago-instore.service.ts:399`
Evidencia: `JSON.stringify({headers,body})` y `body=${jsonBody}` completo.
Qué implica: tokens, correos de pagadores y montos quedan en logs y copias. Riesgo legal y de filtración.
Cómo solucionarlo: loguear solo identificadores y recortar montos sin PII.
```diff
- logger.log(JSON.stringify({headers, body}))
+ logger.log(`WEBHOOK topic=${topic} resourceId=${resourceId} requestId=${requestId}`);
```

## 6. Hallazgos bajos

### L1 — Timeouts sin reintento con espera aleatoria
Ubicación: `mercadopago-instore.service.ts:37,332-463`, `payments.service.ts:34-39`
Qué implica: un corte de 2 segundos falla el cobro aunque Mercado Pago esté sano.
Cómo solucionarlo: 3 intentos con espera 500ms, 1500ms, 3000ms más aleatoriedad, solo en errores 5xx o red.

### L2 — QR vencido sin limpieza automática
Ubicación: `backend/src/modules/sales/sales.service.ts:455-484`
Qué implica: órdenes pendientes ocupan la caja QR única y bloquean el siguiente cobro.
Cómo solucionarlo: tarea cada 5 minutos que cancele `PENDING >15min` y llame a `deleteOrder` en Mercado Pago.

## 7. Plan de remediación priorizado

Semana 1 bloqueantes: forzar firma estricta + tolerancia `ts`, agregar `X-Idempotency-Key` por venta, instalar SDK.
Semana 2 altos: separar `test` y `live`, crear reembolsos + estados reales, endurecer polling con cursor persistido.
Semana 3 medios y bajos: cola con reintentos, recorte de logs, cron de vencidos, pruebas de homologación con `payment_id` y `order_id` de prueba.

## 8. Checklist de calidad (actualizado 2026-09-28 tras Fases 1-6, rama `fix/mp-homologacion-fase1`, sin deploy)

| Criterio | Estado | Detalle |
|---|---|---|
| SDK oficial | Cumple | `mercadopago@3.6.1` instalado; `getPayment` y `PaymentRefund` por SDK (Fase 2/4). PUT/DELETE Instore QR siguen por `fetch` (el SDK no cubre ese endpoint) con `X-Idempotency-Key` + retry |
| Credenciales prueba y producción | Cumple (código; falta cargar valores) | `MP_ENV` + `MP_TEST_ACCESS_TOKEN` / `MP_LIVE_ACCESS_TOKEN` + guard fail-fast `live+TEST-` + entorno visible en `GET /mp-oauth/status` (Fase 3). Pendiente operativo: cargar tokens TEST en `.env` |
| Idempotencia en creación | Cumple | `X-Idempotency-Key = <external_reference>:<uuid>` por intento en QR web y entradas + PUT idempotente por URL (Fase 2) |
| Idempotencia webhook | Cumple | `PaymentEvent` unique + reserva `movimientoMP` pre-venta anti-doble-confirm (Fase 3 M2) |
| Firma webhook | Cumple (código; falta secret) | Estricta en prod siempre, `merchant_order` igual que `payment`, tolerancia `ts` 300s, fail-closed sin secret (Fase 1). Pendiente operativo: `MP_WEBHOOK_SECRET` (§10.2) |
| Estados de pago | Cumple | `refunded→REFUNDED`, `charged_back→CHARGEBACK`; `mapSaleStatus` los lleva a `REJECTED` (Fase 4) |
| Reembolsos | Cumple | `POST /sales/:id/refund` solo ADMIN, total, con reversión stock+vouchers (Fase 4). Limitación v1: reembolsos desde panel MP no revierten stock |
| Errores y reintentos | Cumple | Retry `500/1500/3000ms+jitter` en API + cola `WebhookRetry` 5 intentos `5s→30m` + `DEAD` manual (Fase 2/5). Sin Redis a propósito |
| Seguridad y PCI | Cumple | QR + transferencia, sin tarjetas en servidor; logs recortados (Fase 1/2: sin headers/body) |
| Experiencia de cobro | Cumple | Polling + cancelación + cron vencidos (Fase 5 L2); UX `IN_PROCESS`/`EXPIRED`/`REFUNDED`/`CHARGEBACK` con hints y botón Reintentar (Fase 6b) |
| OAuth y renovación | Cumple | Renovación a 5 minutos y cron diario (sin cambios) |
| Observabilidad | Cumple | Correlación total por `requestId` completo en webhook + retry + hints (Fase 1/5) |

## 9. Referencias

* Webhooks y firma `x-signature`: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
* QR Instore órdenes: https://www.mercadopago.com.ar/developers/es/docs/instore-qrcode/qr-order
* SDK Node e idempotencia: https://www.mercadopago.com.ar/developers/es/docs/sdks-library/server-side/node
* Búsqueda de pagos: https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_search/get
* Reembolsos: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/refunds
* OAuth y renovación: https://www.mercadopago.com.ar/developers/es/docs/security/oauth
* Homologación: https://www.mercadopago.com.ar/developers/es/docs/getting-started/homologation

## 10. Bitácora de ejecución (TODO reanudable)

> Punto de retorno: tag `pre-mp-homologacion-20260928` en `origin` (HEAD `5c83bc4`).
> Backup DB: `/tmp/opencode/mp-pre-backup-20260928.sql` (189K, `pg_dump --no-owner`).
> Rama de trabajo: `fix/mp-homologacion-fase1`. Contrato POS congelado: `docs/contrato-pos-entradas.txt` no se toca.
> Alcance acordado 2026-09-28: Todo (QR web + QR Entradas/POS externo + Transfer CVU + reembolsos), directo a prod, migrar a SDK oficial, refunds con migración segura.

| Fase | Item auditoría | Estado | Commit / Tag | Verificado |
|---|---|---|---|---|
| 0 | Blindaje: tag + backup + branch + baseline tests | HECHO | tag `pre-mp-homologacion-20260928` (push ok), backup `/tmp/opencode/mp-pre-backup-20260928.sql`, branch `fix/mp-homologacion-fase1` | `git tag --list` ok, `pg_dump` 189K, tests base 16/16 pass |
| 1 | C1 firma estricta + ts 5min + merchant_order igual + M3 recorte logs | HECHO | commit `5186da1` en branch `fix/mp-homologacion-fase1` (push ok) | 18/18 pass + `npm run build` ok |
| 2 | C2 SDK oficial + X-Idempotency-Key + L1 retry jitter | HECHO | commit `41b936e` en `fix/mp-homologacion-fase1` (push ok) | build ok, webhooks 18/18, instore 9/9; `Sale.mpIdempotencyKey` diferido a migración única Fase 4 |
| 3 | H2 test/live split + H3 polling cursor persistido + M2 idempotencia transfer | HECHO | commit `b422665` en `fix/mp-homologacion-fase1` (push ok) | build ok, 27/27 pass; columna aplicada en DB viva + migración idempotente para deploy |
| 4 | H1 refunds + REFUNDED/CHARGEBACK + endpoint `POST /sales/:id/refund` | HECHO | commit `850aa41` en `fix/mp-homologacion-fase1` (push ok) | build back+front ok; webhooks 18/18, instore 9/9, refunds 5/5, utils 6/6; enum aplicado en DB viva |
| 5 | M1 cola DB persistente + L2 cron QR vencidos + observabilidad requestId | HECHO | commit `bfc6e98` en `fix/mp-homologacion-fase1` (push ok) | build ok, 38/38 pass; tabla aplicada en DB viva |
| 6 | Homologación: checklist + quality_evaluation + form_homologation | PARCIAL | form QR (prod.33) relevado; checklist API no aplicable; evaluation bloqueada | Bloqueado hasta deploy + pago TEST <7 días (ver §10.7) |
| 6b | UX `in_process`/`expired` + §8 actualizado | HECHO | commit `3322173` en `fix/mp-homologacion-fase1` (push ok) | build front ok |
| 7 | Limpieza `.env` (rama `chore/env-cleanup`) | PARCIAL (solo muertas) | backup `.env.bak-20260928` | Gate OAuth: `mpLinked=false` → legacy vigente, no se toca código ni tokens |

### 10.1 Fase 1 — detalle (2026-09-28, HECHO, sin deploy aún)

Cambios:
- `backend/src/modules/sales/webhooks/mercadopago-webhook.controller.ts`: `WEBHOOK_RECEIVED` recortado a `method/url/topic/resourceId/requestId` (sin headers/body); `verifySignature` acepta `MP_WEBHOOK_SECRET || MP_WEBHOOK_SECRET_LIVE`; `isStrictPaymentEnabled(prod=true)` fuerza `true` en prod; `merchant_order` rechaza igual que `payment` en strict; `ts` con tolerancia 300s (`WEBHOOK_MP_SIGNATURE_STALE → 401`); sin secret en prod → fail-closed `401` en payment/merchant_order.
- `mercadopago-webhook.controller.spec.ts`: +2 tests (merchant_order strict → 401; firma válida pero ts viejo → 401 replay).
- `.env.example`: `MP_WEBHOOK_STRICT_PAYMENT=true` (prod lo fuerza igual).

Verificación: `npm test -- src/modules/sales/webhooks/` 18/18 pass; `npm run build` ok.

### 10.2 ACLARACIÓN — MP_WEBHOOK_SECRET es único de la app, NO por usuario (2026-09-28)

OAuth evita que cada vendedor toque el panel de MP: vincula con 1 click (`GET /mp-oauth/connect`) y el sistema guarda `mpAccessToken/Store/POS` por cuenta. El `MP_WEBHOOK_SECRET`, en cambio, es **uno solo, de NUESTRA aplicación** (`developers.mercadopago.com → Tus integraciones → la app con MP_CLIENT_ID → Webhooks → clave secreta`). MP firma todos los webhooks al `notification_url` (`https://pos.csdsoler.com.ar/api/webhooks/mercadopago`, ver `mercadopago-instore.service.ts:getNotificationUrl`) con esa clave. Por eso es un paso manual **único del operador**, no por usuario. Futuro (Fase 3+): guardar ese secret en tabla `Setting` editable desde `/admin` para no tocar `.env` (igual que WhatsApp).

BLOQUEADO antes del deploy: `.env` actual `MP_WEBHOOK_SECRET=MISSING`, `MP_WEBHOOK_SECRET_LIVE=MISSING`, `NODE_ENV=MISSING`. Sin secret, con `NODE_ENV=production` el código Fase 1 responde `401` a webhooks reales (fail-closed correcto para homologación, pero corta cobros QR hoy).
Antes de `docker compose up --build`: copiar el secret de TU app MP → `.env` (`MP_WEBHOOK_SECRET=...`), setear `NODE_ENV=production`, validar con 1 cobro QR test + `docker compose logs backend | grep WEBHOOK_`.
Rollback: `git reset --hard pre-mp-homologacion-20260928` + restore backup `/tmp/opencode/mp-pre-backup-20260928.sql` + `docker compose up -d --build`.

### 10.3 Fase 2 — detalle (2026-09-28, HECHO, sin deploy aún)

Cambios:
- `backend/package.json`: agregada dependencia `mercadopago@3.6.1` (SDK oficial). Instalación requirió `sudo chown -R ubuntu:ubuntu node_modules package.json package-lock.json` porque `node_modules` había quedado con owner `root` del build Docker.
- `mercadopago-instore.service.ts`: `createOrUpdateOrder` (ventas web `sale-<id>`) y `putTicketOrder` (entradas `ticket-<id>`) generan `X-Idempotency-Key = <external_reference>:<uuid>` por intento y lo reutilizan en los reintentos del mismo intento (evita doble orden ante timeout/doble click). `request()` envía el header, reintenta 3 veces `500/1500/3000ms+jitter ≤250ms` solo en `429/5xx/timeout/red` (4xx fail-fast), con `AbortController` fresco por intento y timeout 15s intacto. Log de request recortado a `hasBody/idempotency` (sin body completo, completa M3). `getPayment()` ahora usa SDK `Payment(new MercadoPagoConfig({accessToken}))` con fallback a `fetch` si el SDK falla (sin caída).
- Decisión sin migración: NO se creó columna `Sale.mpIdempotencyKey` para evitar 2 migraciones; el PUT Instore ya es idempotente por URL (`external_reference` único) + header por intento. La columna se agregará en Fase 4 junto a `REFUNDED/CHARGEBACK` en una sola migración.

Verificación: `npm run build` ok; `src/modules/sales/webhooks/` 18/18 pass; `mercadopago-instore.service.spec.ts` 9/9 pass. Suite completa `src/modules/sales/` excede timeout local (no se corre entera para no bloquear).

### 10.4 Fase 3 — detalle (2026-09-28, HECHO, sin deploy aún)

Cambios:
- H2 `mp-config.service.ts`: `getEnvironment()` (`MP_ENV=test|live`, inferido por prefijo `TEST-`/`APP_USR-` si falta); `resolveEnvToken()` usa `MP_TEST_ACCESS_TOKEN` en test y `MP_LIVE_ACCESS_TOKEN` en live con fallback legacy `MP_ACCESS_TOKEN`; guard fail-fast: `live + TEST- → throw 'Token de prueba en entorno live'`; `test + APP_USR- → warn`. `getTokenSource()` para diagnóstico. `mercadopago-oauth.service.ts:getStatus()` ahora expone `env/isTest/tokenSource` (visible en panel). `.env.example`: `MP_ENV/MP_TEST_ACCESS_TOKEN/MP_LIVE_ACCESS_TOKEN`. Webhook acepta `MP_WEBHOOK_SECRET || _LIVE || _TEST`.
- H3 `payments.service.ts`: cursor persistido `Setting.lastMpPollAt` (default 5min, clamp 15min, futuro → 2min); paginación `limit 50/offset` hasta 3 páginas (150 pagos, antes `limit 10` sin offset = pagos perdidos con >10); DB como fuente de verdad (`movimientoMP.notificado/procesado`, sobrevive reinicios; `seenPaymentIds` queda como caché extra); cursor se guarda en cada poll exitoso. Migración `20260928132541_add_setting_last_mp_poll_at` (`ADD COLUMN IF NOT EXISTS`, idempotente). Columna ya aplicada en DB viva vía `psql` (el container tiene imagen vieja sin la migración; en el próximo `up --build` se aplica sola sin conflicto).
- M2 `confirmTransfer`: reserva `movimientoMP{procesado:false}` ANTES de crear la venta; doble confirm concurrente → `P2002` → si ya procesada devuelve venta existente, si reserva huérfana sin venta la completa, sino `409 Conflict` (antes: `upsert` post-venta = 2 ventas posibles).

Verificación: `npx prisma generate + validate` ok; `npm run build` ok; webhooks 18/18 + instore 9/9 = 27/27 pass; backend container vivo (imagen vieja, deploy pendiente con secret).

### 10.5 Fase 4 — detalle (2026-09-28, HECHO, sin deploy aún)

Alcance acordado: reembolso TOTAL, solo `MP_QR`, revierte stock + desactiva vouchers, botón en detalle de venta solo ADMIN.

Cambios backend:
- Migración `20261229000000_add_mp_refund_states` (nombre posterior a la última existente para orden correcto): `PaymentStatus ADD VALUE IF NOT EXISTS REFUNDED/CHARGEBACK` + `Sale.mpIdempotencyKey TEXT` (diferida de Fase 2, misma migración) + `Sale.refundedAt`. Aplicada en DB viva vía `psql` (enum verificado con 6 valores); migración idempotente para el próximo `up --build`.
- `mercadopago-webhook.utils.ts`: `refunded→REFUNDED`, `charged_back→CHARGEBACK` (antes REJECTED); `mapSaleStatus` mapea ambos a `SaleStatus.REJECTED` (reportes intactos). Spec actualizado +1 test.
- `sales/services/refunds.service.ts` (nuevo): `refundSale(saleId, {id, role})` — `403` si no ADMIN; valida QR + APPROVED + no reembolsada + `mpPaymentId`; SDK `PaymentRefund.create({payment_id, requestOptions:{idempotencyKey:'refund:<saleId>'}})` (reembolso total: sin `body`); transacción setea `REFUNDED/REJECTED/refundedAt` + `mpRaw` con respuesta y auditor (`refundedBy`); revierte stock con `increment` atómico (espejo de `decrementStockForSale`, compuestas incluidas); `deactivateBySale` en try/catch (si falla, warn y el admin reintenta desde vouchers). Errores MP ya-reembolsado → `409`.
- `sales.controller.ts`: `POST /sales/:id/refund` con `@RequireModule(VENTAS, FULL)` + check ADMIN en servicio. Registrado en `sales.module.ts`.
- Limitación v1 documentada: reembolsos hechos en panel MP llegan por webhook como `REFUNDED` sin reversión de stock/vouchers (el camino soportado es la GUI). Entradas (`TicketSale`) fuera de alcance.

Cambios frontend:
- `api/types.ts`: `PaymentStatus` suma `REFUNDED/CHARGEBACK`; `Sale` suma `paymentStatus/mpPaymentId/refundedAt`.
- `AdminSalesPage.tsx`: botón `Reembolsar` (`btn-danger`) en el footer del modal solo si `role==='ADMIN' && MP_QR && paymentStatus APPROVED && !refundedAt && status APPROVED`; confirm con total, `isRefunding`, toast, `invalidateQueries(['admin-sales'])`; badges `Reembolsada/Contracargo`.

Verificación: `prisma generate + validate` ok; `npm run build` backend ok; frontend `tsc + vite` ok (8.59s); suites: webhooks 18/18 (con nuevo mapeo), instore 9/9, refunds 5/5 nuevo. Combo de 4 suites en paralelo dio 1 worker flake (28 tests pass, 0 fail); re-corridas por separado e `--runInBand` todo verde.

### 10.6 Fase 5 — detalle (2026-09-28, HECHO, sin deploy aún)

Cambios (sin Redis a propósito: un servicio más = un punto de caída más):
- M1 Migración `20261229000001_add_webhook_retry` (idempotente): tabla `WebhookRetry` (`provider/topic/resourceId` unique, `payload` Json, `requestId`, `attempts`, `nextRetryAt`, `lastError`, `status PENDING|DONE|DEAD`, índice `(status,nextRetryAt)`). Aplicada en DB viva vía `psql`.
- `mercadopago-webhook-processor.service.ts`: `processWebhook` ahora es wrapper (core + `enqueueRetry` + rethrow; el controller sigue respondiendo 200 inmediato y logueando como antes). `processWebhookCore` = lógica anterior intacta (transiciones de estado por duplicados preservadas). Backoff persistido `5s/30s/2m/10m/30m`, 5 intentos → `DEAD` (revisión manual, `WEBHOOK_RETRY_DEAD`). Cron `@Cron(EVERY_MINUTE)` reprocesa hasta 10 vencidos; `DEAD` no se toca (solo actualiza payload/error). `requestId` completo correlaciona todo el flujo (observabilidad).
- L2 `sales.service.ts`: `cancelQrSale` tolera `404` de MP (orden ya inexistente → cancela local igual; antes fallaba y reintentaba eternamente). Cron `@Cron(EVERY_5_MINUTES)` cancela `MP_QR + PENDING + >15min` (máx 20, más viejas primero) como `system-cron/ADMIN`, con catch por venta. `sales.module.ts` importa `ScheduleModule.forRoot()`. Entradas (`TicketSale`) fuera de alcance: su cancelación la maneja el terminal.
- Specs nuevos: `mercadopago-webhook-retry.spec.ts` (3 tests: enqueue+rethrow, DONE, DEAD) + `sales-cleanup.spec.ts` (2 tests: cancela 2 y tolera fallo, vacío no-op).

Verificación: `prisma generate` ok; `npm run build` ok; 38/38 pass (webhooks 18, instore 9, refunds 5, utils 6, retry 3, cleanup 2 — corridas `--runInBand`; el runner paralelo da flakes de workers, no fallos de tests).

### 10.7 Fase 6 — homologación (2026-09-28, PARCIAL, bloqueada hasta deploy)

Relevado vía MCP (cuenta con 3 apps: `solertest1`, `Noti-Transf`, `m-POSw 7566305658638578`):
- `quality_checklist` → error en las 3 apps: `Product not homologable`. La API de homologación no cubre producto Instore QR; no es un problema de nuestro código.
- `form_homologation get_form product_id=33 (QR Code)` → OK: 2 pasos (`operation`: marcas/países/cuentas; `qrFeatures`: descuentos por medio de pago opcional). Respuestas sugeridas: una marca, un país, una cuenta por país.
- `quality_evaluation` → BLOQUEADO: exige `payment_id`/`order_id` TEST <7 días y no existe ningún cobro de prueba reciente (ni despliegue con los cambios). Pasos post-deploy: setear `MP_ENV=test` + `MP_TEST_ACCESS_TOKEN` (TEST-) en ventana de prueba, hacer 1 cobro QR + 1 transferencia + 1 reembolso, correr evaluation con esos IDs, luego `form submit` y volver a `MP_ENV=live`.

### 10.8 Fase 6b — UX estados + §8 (2026-09-28, HECHO, sin deploy aún)

- `frontend/src/pages/CheckoutQrPage.tsx`: mensajes diferenciados `IN_PROCESS` ("en proceso, no cierres"), `WAITING_PAYMENT`, `EXPIRED` ("el QR venció, generá uno nuevo"), `REFUNDED`/`CHARGEBACK` (antes caían en "Esperando pago…" sin mensaje); `handleTerminalStatus` maneja los 5 terminales con hint amigable de `mpStatusDetail` (`pending_waiting_payment`, `pending_contingency`, `pending_review_manual`, `expired`); timer visible solo mientras espera; botón `Reintentar pago` (primary) en errores terminales en vez de solo `Volver`.
- §8 actualizado a estados reales post-Fases 1-5 (todo Cumple salvo pendientes operativos: valores TEST y secret).

Verificación: `tsc + vite` ok (8.36s).

### 10.9 Fase 7 — limpieza `.env` (2026-09-28, PARCIAL, rama `chore/env-cleanup`)

Pedido: limpiar `.env` (tokens MP supuestamente obsoletos con OAuth). Gate inicial en DB de desarrollo (`m-posw-db-1`): `mpLinked=false` → se abortó la limpieza total por seguridad.
Corrección con instancia productiva (`~/srv/mposw/soler`, contenedores `soler-*`): `Setting.mpLinked=true`, `mpAccessToken` (75ch), refresh válido hasta 2026-12-01, store/pos configurados → **prod usa OAuth (DB), no `.env`**. Su `.env` ni siquiera tiene `MP_ACCESS_TOKEN`/`MP_COLLECTOR_ID`/`MP_ENV`. Además prod SÍ tiene `MP_WEBHOOK_SECRET` y corre con `NODE_ENV=production` (verificado en container) → el fail-closed de Fase 1 funcionará al desplegar. La limpieza total del fallback legacy queda viable post-deploy (manteniendo `MP_ENV/TEST/LIVE` para homologación).
Aplicado (cero riesgo, 0 referencias en código/compuestas/docs):
- Eliminadas de `.env` y `.env.example`: `MP_DEFAULT_EXTERNAL_STORE_ID`, `MP_DEFAULT_EXTERNAL_POS_ID`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PIN`, `CAJA01_PASSWORD` (comentadas y activas).
- Backup: `.env.bak-20260928` (gitignorado, junto a `.env.bak-20260914`).
- Se mantienen: `MP_ACCESS_TOKEN`/`MP_COLLECTOR_ID` (fallback vigente), `MP_ENV/TEST/LIVE` (homologación), secrets webhook, OAuth, Supabase, Vite, Docker.
- Verificado: `grep` 0 refs + `docker compose config` válido. Sin cambios de código → sin build/tests.
Condición para retomar la limpieza total: vincular OAuth en prod (`GET /mp-oauth/connect` → `mpLinked=true`) y recién ahí quitar legacy del código (ver plan en conversación 2026-09-28).

Próximo paso para otra instancia: deploy (con `MP_WEBHOOK_SECRET` + `NODE_ENV=production` de §10.2) y luego evaluación con pagos TEST reales. Rollback: tag `pre-mp-homologacion-20260928` + backup `/tmp/opencode/mp-pre-backup-20260928.sql`.

### 10.10 Deploy prod soler (2026-09-28, HECHO)

- Merge a `main` (`9dc8225` + `aea6559`) + tag rescate `v2.0.1-pre-mp`. Actions compiló `:latest` (verificado en imagen: `processWebhookCore`, mapeo `REFUNDED`, bundle front con "Reintentar pago").
- Instancia `~/srv/mposw/soler`: backup DB `soler-pre-mp-20260928.sql` (2.0M en `/tmp/opencode/`); `pull` + `down/up -d` (sin `--build`: soler usa imágenes del registry).
- Migraciones aplicadas manual + `resolve --applied` x3 (el `ADD VALUE` de enum no corre en transacción de `migrate deploy`): `lastMpPollAt`, `REFUNDED/CHARGEBACK` + `mpIdempotencyKey` + `refundedAt`, tabla `WebhookRetry`. Arranque limpio, `migrate deploy` sin pendientes.
- Humo: login OK, `GET /mp-oauth/status` → `linked:true, env:live, tokenSource:oauth`; frontend sirve bundle nuevo; únicos errores en logs = mis pruebas de humo (404/400 intencionales).
- Rollback: pinnear `:v2.0.1-pre-mp` en compose, o tag `pre-mp-homologacion-20260928` + backup SQL.
- Pendiente: ventana TEST (`MP_ENV=test` + token TEST) para `quality_evaluation` + `form submit` (§10.7).

### 10.11 Incidente #1803 + fix expire-race (2026-09-28, HECHO, pendiente deploy)

Síntoma: venta QR #1803 ($100) pagada en MP pero `PENDING` tras 2 min. Causa raíz: `MP_WEBHOOK_SECRET` de prod no coincidía con el generado en el panel (webhooks nunca configurados ahí) → `401` en todos los webhooks. Resuelto: secret del panel → `.env` prod (backup `.env.bak-20260928-secret`) + restart backend.
Bugs propios hallados al recuperar (fix en `sales.service.ts` + `sales-expire.spec.ts` 4/4):
- `cancelQrSale` toleraba 404 solo por mensaje; el error real es objeto `{response:{status}}` → `String() = "[object Object]"` → 500 y cleanup fallando en ventas viejas.
- `expireIfNeeded` expiraba ANTES de buscar el pago (podía marcar `EXPIRED` una venta pagada). Ahora `findApprovedPayment()` primero: si MP tiene aprobado → aprueba local en vez de expirar.
Verificación: build ok, 42/42 pass (38 + 4 nuevos).
Resolución #1803 (2026-09-28 ~15:11): con secret + fix desplegados (`:latest` con `findApprovedPayment`), `GET payment-status` aprobó la venta (payment `181282340620`) y `POST complete` la finalizó con stock. Scan posterior: 0 firmas inválidas, 0 FATAL/DEAD.

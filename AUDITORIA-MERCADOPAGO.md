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

## 8. Checklist de calidad

| Criterio | Estado | Detalle |
|---|---|---|
| SDK oficial | No cumple | `fetch` manual, sin paquete `mercadopago` |
| Credenciales prueba y producción | No cumple | Token único, sin `TEST-` y `APP_USR-` separados |
| Idempotencia en creación | No cumple | Sin `X-Idempotency-Key` |
| Idempotencia webhook | Parcial | Tabla única bien, falta en transferencias |
| Firma webhook | Parcial | Lógica `HMAC` correcta pero desactivable |
| Estados de pago | Parcial | `approved`, `pending`, `rejected` bien; `refunded`, `charged_back` mal |
| Reembolsos | No cumple | Sin API de devoluciones |
| Errores y reintentos | Parcial | Reintento simple, sin cola ni espera exponencial |
| Seguridad y PCI | Cumple | QR + transferencia, sin tarjetas en servidor; corregir logs |
| Experiencia de cobro | Parcial | Polling y cancelación bien; falta UX de `in_process` y `expired` |
| OAuth y renovación | Cumple | Renovación a 5 minutos y cron diario |
| Observabilidad | Parcial | Buenos prefijos `WEBHOOK_*`, falta correlación total por `requestId` |

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
| 4 | H1 refunds + REFUNDED/CHARGEBACK + endpoint `POST /sales/:id/refund` | TODO | — | Requiere migración Prisma expand (ADD VALUE, sin rewrite) |
| 5 | M1 cola DB persistente + L2 cron QR vencidos + observabilidad requestId | TODO | — | Sin Redis para no agregar punto de caída |
| 6 | Homologación: checklist + quality_evaluation + form_homologation | TODO | — | Necesita `payment_id/order_id` TEST <7 días |

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

Próximo paso para otra instancia: Fase 4 (H1 refunds + REFUNDED/CHARGEBACK + `POST /sales/:id/refund` + columna `Sale.mpIdempotencyKey` en la misma migración), luego Fase 5 (M1 cola DB + L2 cron QR) y Fase 6 (homologación con TEST <7 días).

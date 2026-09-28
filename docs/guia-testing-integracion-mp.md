# Guía de testing de integración Mercado Pago — QR presencial (Instore) + Transferencias

> Solución bajo prueba: **QR Instore presencial** (órdenes QR dinámicas por venta, POS dedicado para
> Entradas) + **transferencias CVU/alias** (polling + confirmación). Fuente: exclusivamente documentación
> oficial de Mercado Pago Developers (ES, site MLA) vigente a 2026-09-28. Ver §5 para brechas declaradas.

## 1. Control de testing de integración

### 1.1 Requisitos oficiales
- Aplicación creada en [Tus integraciones](https://www.mercadopago.com/developers/panel/app), con tienda
  (`store`) y caja (`pos`) configuradas
  (ref: `/developers/es/docs/qr-code/create-store-and-pos`).
- Webhooks configurados en **Modo productivo** con URL HTTPS + eventos de pago; la clave secreta generada
  se usa para validar `x-signature` (ref: notificaciones/webhooks y `/checkout-api-orders/notifications`).
- App de Mercado Pago instalada + cuenta de vendedor y de comprador (ref: QR overview, requisitos previos).
- Para flujos de homologación interoperable: credenciales OAuth de homologación + `access_token_seller`,
  `point_of_sale_id` y `qr_data` provistos por el equipo de Soporte MP.

### 1.2 Credenciales: prueba vs. producción
| Credencial | Prefijo / origen | Uso permitido |
|---|---|---|
| Access Token de prueba | `TEST-…` | Solo backend de pruebas. **Documentado solo para Checkout API y Checkout Bricks**; si el producto no trae credenciales de prueba, usar credenciales de producción **de una cuenta de prueba** (ref: docs Credenciales) |
| Access Token productivo | `APP_USR-…` | Solo backend productivo. Nunca en frontend ni query params (solo header `Authorization: Bearer`) |
| OAuth (nuestro caso) | `authorization_code` → `access_token` + `refresh_token` | Token del vendedor vinculado; el backend lo renueva automáticamente. En pruebas se usa el token de la **cuenta vendedora de prueba** |
| Webhook secret | Panel → Webhooks → clave generada | Valida `x-signature` en ambos ambientes. Se rota con "Restablecer" |

### 1.3 Ambientes
- **Pruebas/homologación:** endpoints con segmento `/beta/` (ej. `/mpmobile/beta/instore/qr/{pos}`,
  `/instore/v2/beta/external/resolve`) + simulador de notificaciones del panel ("Simular notificación").
- **Producción:** mismos endpoints sin `/beta/`. Nuestra integración usa producción con OAuth del vendedor.
- **Diferencias test vs. prod:** en prueba no hay movimiento real de dinero; los `status_detail`,
  tiempos de acreditación y reintentos de webhook pueden diferir; el `ts` de `x-signature` viene en
  segundos en v2 (el SDK lo multiplica ×1000 para tolerancia); los pagos de prueba exigen `coelsa_id`
  como evidencia ante Soporte en flujos interoperables.

## 2. Usuarios de prueba

> Crear en Developers → Cuentas de prueba (seller + buyer, país **MLA**). No inventar saldos ni
> comportamientos: lo no documentado se marca como brecha (§5).

- **Vendedor (seller).** País: MLA (Argentina). Etiqueta sugerida: `mp-soler-vendedor-test`.
  Propósito: ser `collector` de las órdenes (su `user_id`/`collector_id`, su tienda y su POS de prueba);
  su Access Token (de prueba u OAuth de homologación) firma las llamadas de creación de orden y es la
  cuenta que recibe el dinero simulado.
- **Comprador (buyer).** Etiqueta sugerida: `mp-soler-comprador-test`. Propósito: escanear el QR desde la
  app wallet y pagar con dinero en cuenta o tarjeta de prueba. Brecha declarada: la documentación no
  detalla saldos iniciales ni fondeo automático de billeteras de prueba para QR Instore; alternativa
  oficial más cercana: tabla de tarjetas de prueba (`/qr-code/.../test/cards`, `holder.name` = estado
  deseado) y endpoints beta de resolve/planes con `access_token_wallet` vía OAuth Client Credentials.

## 3. Simulación paso a paso (flujo atendido / monto cerrado — nuestro caso)

Leyenda de capa: **[BE]** backend · **[FE]** frontend · **[EXT]** sistema externo (wallet MP, API MP).
Los endpoints `api.mercadopago.com` son oficiales; los `/api/...` son nuestra implementación (marcados).

| # | Acción | Por qué | API / recurso | Capa |
|---|---|---|---|---|
| 1 | Crear venta y orden QR con `external_reference=sale-<uuid>` | Fija monto e ítems y vincula el pago con la venta (conciliación) | **[BE]** `PUT /instore/qr/seller/collectors/{id}/stores/{s}/pos/{p}/orders` + `X-Idempotency-Key` | BE→EXT |
| 2 | Renderizar el QR (`qr_data`) en pantalla con timeout visible | El comprador necesita el QR dinámico de la transacción | **[FE]** pantalla de pago QR | FE |
| 3 | Escanear y pagar desde la wallet del comprador de prueba | Ejecuta el débito/acreditación simulada | **[EXT]** app Mercado Pago | EXT |
| 4 | Recibir webhook `payment` + `merchant_order` | Confirmación push en tiempo real (reintentos c/15 min si no hay 200/201 en 22 s) | **[EXT]** `POST <notification_url>` → **[BE]** `/api/webhooks/mercadopago` | EXT→BE |
| 5 | Validar firma `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<...>;ts:<...>;`) | Autenticidad; rechazar con 401 lo inválido | **[BE]** validador (compatible con `WebhookSignatureValidator` del SDK) | BE |
| 6 | Consultar el pago y conciliar por `external_reference` | El webhook es solo aviso; la verdad está en la API | **[BE]** `GET /v1/payments/{id}` | BE→EXT |
| 7 | Aprobar venta, descontar stock, generar vouchers, avisar por socket | Cierre operativo atómico e idempotente | **[BE]** transacción local + websocket | BE→FE |
| 8 | Reembolsar total (ADMIN) | Flujo de devolución soportado | **[BE]** `POST /v1/payments/{id}/refunds` → estado `REFUNDED` | BE→EXT |
| 9 | Transferencia: sondear, detectar, confirmar | No usa webhooks; el comprador transfiere al CVU/alias publicado | **[BE]** `GET /v1/payments/search` → **[FE]** confirmación | BE/FE |
| 10 | Casos negativos | `expired` (>15 min, limpieza + UX Reintentar), `rejected`, webhook duplicado (misma respuesta), firma inválida (401), doble confirmación (409) | Mixto | BE/FE |

Criterio de aceptación por paso: respuesta esperada documentada (ej. resolve `closed_amount`,
pago `approved`/`accredited`, webhook 200/201, venta `APPROVED` con `mpPaymentId` persistido).

## 4. Restricciones técnicas y resguardos

- No se inventan endpoints, campos, estados ni lógica: todo lo `api.mercadopago.com` citado existe en
  las referencias oficiales; los ejemplos de este documento están marcados como **ejemplos**.
- Comportamiento no documentado (saldos de prueba, firma del formato Feed legacy `?id=&topic=`,
  tiempos exactos de reintento más allá de "c/15 min con backoff progresivo") se declara como brecha
  en §5 con su recurso oficial más cercano.
- Ejemplo (marcado como ejemplo, no código productivo):
```json
{
  "external_reference": "sale-ejemplo-uuid",
  "title": "Venta POS",
  "total_amount": 100.00,
  "items": [{ "title": "Café", "quantity": 1, "unit_price": 100.00 }]
}
```

## 5. Brechas declaradas y recursos oficiales

1. **Firma del formato Feed legacy** (`?id=&topic=`, `user-agent: MercadoPago Feed v2.0`): sin fórmula
   documentada; nuestra integración la verifica consultando la API. Recurso: validador del SDK
   (https://github.com/mercadopago/sdk-nodejs) + docs de webhooks.
2. **Fondeo/saldos de billeteras de prueba para QR**: no detallado; alternativa: tabla de tarjetas de
   prueba + flujos beta `resolve`/`plans` con `access_token_wallet`.
3. **Homologación Instore vía API**: la API de homologación responde `Product not homologable`; vía
   válida: escenarios con Soporte + `coelsa_id` como evidencia.

## Declaración profesional

Esta guía se basa exclusivamente en la documentación oficial de Mercado Pago vigente al momento de su
elaboración. **No garantiza una integración perfecta. Cada salida debe validarse y probarse manualmente
antes de un despliegue en producción.**

# AGENTS.md — m-POSw

Mini POS Web: punto de venta para eventos/jornadas y clubes. Stack: **React 18 + Vite** (frontend), **NestJS 10 + Prisma 5** (backend), **PostgreSQL** (DB), **Kotlin/Android** (terminal POS, `m_posw_entradas/`) y **Flutter** legacy (`m_posw_android/`).

Documentos relacionados: `DESIGN.md` (fuente de verdad de UI), `README.md` (descripción funcional), `INFRAESTRUCTURA.md` (deploy/infra), `TODO.md` (pendientes).

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (React+Vite) │  Backend (NestJS)  │  PostgreSQL  │
│  Port: 8080            │  Port: 3000        │  Port: 5432  │
└────────────────────────────────────────────────────────────┘
```

- **Frontend**: Nginx sirve el build estático y proxya `/api/*` y `/uploads/*` al backend.
- **Backend**: corre `prisma migrate deploy` al arrancar el contenedor (`docker-entrypoint.sh`).
- **Android**: `m_posw_entradas/` es la APK dual ENTRADAS/POS (Kotlin; Sunmi V2s con impresora integrada, o cualquier Android con impresora BT 58mm). `m_posw_android/` es la APK Flutter legacy (WebView + impresión Bluetooth).

## Quick Start (Docker)

```bash
cp .env.example .env       # editar variables requeridas
docker network create shared_proxy   # prerequisito (una vez)
docker compose up -d --build
# Frontend: http://localhost:8080   Backend: http://localhost:3000
```

## Environment Variables (críticas)

Ver `.env.example` para el listado completo.

| Variable | Propósito |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Firma de tokens JWT |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciales del admin inicial (seed) |
| `CORS_ORIGIN` | Origen permitido (incluir protocolo) |
| `VITE_API_BASE_URL` | `/api` (con proxy) o URL completa del backend |
| `MP_ACCESS_TOKEN` / `MP_COLLECTOR_ID` | Mercado Pago (opcionales si usás OAuth) |
| `MP_DEFAULT_EXTERNAL_STORE_ID` / `MP_DEFAULT_EXTERNAL_POS_ID` | Store/POS en MP (opcionales si usás OAuth) |
| `MP_TEST_ACCESS_TOKEN` / `MP_LIVE_ACCESS_TOKEN` | Tokens por entorno (fallback legacy a `MP_ACCESS_TOKEN`) |
| `MP_ENV` | `test\|live` (inferido por prefijo del token si se omite) |
| `MP_WEBHOOK_SECRET` | Validación de webhooks de MP |
| `INSTANCE_SUBDOMAIN` | Subdominio para construir la URL de webhook |
| `CADDY_HOST` | Host público de la instancia (POS externo pega a `https://${CADDY_HOST}/api/entradas/...`) |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Credenciales OAuth Mercado Pago |
| `MP_OAUTH_REDIRECT_URI` | URI de callback OAuth |
| `MP_INTEGRATOR_ID` | Integrator ID opcional (header `X-Integrator-Id`) |
| `VOUCHER_API_URL` | URL base de api-radius (default `http://api-radius:3001/api`) |

## Authentication & Permissions

### Login
`POST /auth/login` (username + password) devuelve: `accessToken` (JWT con `userId`, `role`, `username`), `user`, `homeModule` (null = `/home`) y `permissions` (`[{ module, access }]`, vacío para ADMIN).

### Roles
- **ADMIN**: acceso FULL implícito a todo. Sin registros en `UserModulePermission`.
- **USER**: acceso configurable por módulo vía `UserModulePermission`.

### Módulos y niveles (`ModuleKey`)

| Módulo | ModuleKey | Niveles |
|--------|-----------|---------|
| POS | `POS` | HIDDEN, FULL (no acepta READ) |
| Ventas | `VENTAS` | HIDDEN, READ, FULL |
| Socios | `SOCIOS` | HIDDEN, READ, FULL |
| Tesorería | `TESORERIA` | HIDDEN, READ, FULL |
| Acreedores | `ACREEDORES` | HIDDEN, READ, FULL |
| Productos | `PRODUCTOS` | HIDDEN, READ, FULL |
| Internet | `INTERNET` | HIDDEN, READ, FULL |
| Reportes | `REPORTES` | HIDDEN, READ, FULL |
| Configuración | `CONFIGURACION` | HIDDEN, READ, FULL |
| Jugadores | `PLAYERS` | HIDDEN, READ, FULL |
| Patrimonio | `PATRIMONIO` | HIDDEN, READ, FULL |
| Notificaciones | `NOTIFICACIONES` | HIDDEN, READ, FULL |
| Entradas | `ENTRADAS` | HIDDEN, READ, FULL |

- **HIDDEN**: no aparece en sidebar ni es accesible por URL. **READ**: visible, sin botones de escritura. **FULL**: acceso completo.

### Frontend
- Hook `useModuleAccess(moduleKey)` → `'HIDDEN' | 'READ' | 'FULL'`; componente `ModuleRoute` protege rutas (redirige a `/home`).
- Sidebar (`pages/AdminLayout.tsx`) con secciones: **Ventas** (POS, Ventas, Entradas, Estadísticas, Categorías, Productos, Stock), **Administración** (Acreedores, Socios, Tesorería, Patrimonio), **Deportes** (Jugadores), **Sistema** (Internet, Notificaciones, Dispositivos, Usuarios, Configuración), **Home**.
- Home (`/admin/home`) muestra grilla de módulos + KPIs según permisos (`GET /home/metrics`).

### Backend
- `ModuleAccessGuard` + decorador `@RequireModule(ModuleKey, MinAccess)`; el ADMIN bypasea cualquier verificación.

### Gestión de usuarios
`GET/POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (no permite eliminar al admin). Solo ADMIN; los permisos del admin no se modifican.

## Módulos del Sistema (Configuración → Módulos)

Toggles persistidos en `Setting`, aplicados en tiempo real.

| Setting | Default | Efecto al desactivar |
|---------|---------|---------------------|
| `enableSociosModule` | true | Oculta "Socios" del menú y el botón QR del POS |
| `enableTreasuryModule` | true | Oculta "Tesorería" del menú |
| `enableAcreedoresModule` | true | Oculta "Acreedores", el toggle Fiado en Ventas y el botón Fiado del checkout |
| `enableInternetModule` | false | Activa Vouchers WiFi (menú "Internet", categoría en POS, generación de vouchers) |
| `enablePlayersModule` | false | Activa Jugadores (sección Deportes: jugadores, DT's, categorías, torneos) |
| `enablePatrimonioModule` | true | Activa Patrimonio (sección Administración) |
| `enableNotificationsModule` | false | Activa Notificaciones WhatsApp (sección Sistema) |
| `enableEntradasModule` | false | Activa Entradas (sección Ventas) |

Otros flags de medios de pago: `enableCashPayment`, `enableQrPayment`, `enableTransferPayment`, `enableFiadoPayment` (pestaña Ventas → Medios de pago).

## Developer Commands

### Backend (desde `backend/`)
```bash
npm test                      # Jest (*.spec.ts)
npm run build                 # Nest build
npm run start:dev             # Watch
npm run start                 # Producción (node dist/main.js)
npx prisma migrate dev        # Crear migración
npx prisma migrate deploy     # Aplicar (auto en Docker)
npx prisma db seed            # Seed (prisma/seed.ts)
npx prisma studio             # GUI Prisma
npm run check:prisma-fk-types # Validación de tipos FK
```

### Frontend (desde `frontend/`)
```bash
npm run dev      # Vite dev server
npm run build    # tsc + vite build
npm run preview  # Preview build prod
```

### Android
```bash
# Terminal POS (Kotlin) — m_posw_entradas/
./gradlew assembleRelease        # build local (requiere SDK Android)
# Flutter legacy — m_posw_android/
flutter build apk --release
```

### Docker / Deploy
```bash
docker compose up -d --build
docker compose logs -f backend
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
./deploy.sh                  # git pull + rebuild + up
```

## Database Operations

```bash
cd backend && npx prisma migrate reset --force   # reset completo (dev)
./limpiar-datos-operativos.sh --yes              # borra ventas/movimientos/cierres/sesiones/fiado/pagos
```
Conserva usuarios, configuración, categorías, productos, acreedores y socios.

## Mercado Pago Integration

Tres flujos: **QR (Instore v2)**, **Transferencia (CVU/Alias)** y **OAuth 2.0** (vinculación sin tokens manuales).

**Endpoints clave:**
- `POST /sales/:id/payments/mercadopago-qr` — crear orden QR (y `/cancel`)
- `POST /payments/transfer/poll` / `POST /payments/transfer/confirm` — transferencias
- `POST /sales/:id/refund` — reembolso total (solo ADMIN, `MP_QR` aprobada)
- `POST /webhooks/mercadopago` — webhook
- `POST /mp-auditoria/release-sync` — Reporte de Liberaciones (retiros de billetera)
- OAuth: `GET /mp-oauth/connect`, `POST /mp-oauth/token`, `GET /mp-oauth/status`, `DELETE /mp-oauth/disconnect`, `GET /mp-oauth/detect-stores`, `POST /mp-oauth/select-store`, `POST /mp-oauth/setup-pos`

**Resolución de token** (`MercadoPagoConfigService.getAccessToken()`): token OAuth en `Setting` (refresca si vence en <5 min) → fallback `MP_ACCESS_TOKEN` del `.env`.

**Estado actual (referencia vigente):**
- SDK `mercadopago@3.6.1` para `getPayment` y reembolsos. El PUT/DELETE de órdenes Instore QR va por `fetch` con `X-Idempotency-Key` + retry `500/1500/3000ms+jitter` en `429/5xx/timeout/red`.
- Entornos separados `MP_ENV=test|live`; fail-fast si un token `TEST-` corre en `live`.
- Reembolsos revierten stock (atómico) y desactivan vouchers. `PaymentStatus` incluye `REFUNDED` / `CHARGEBACK` (reportes los agrupan como `REJECTED`). Límite: reembolsos disparados desde el panel de MP llegan por webhook sin reversión de stock.
- Webhook estricto en producción (`merchant_order` igual que `payment`), tolerancia `ts` 300s anti-replay, fail-closed sin secret. Sin Redis: cola persistente en `WebhookRetry` (backoff `5s/30s/2m/10m/30m`, 5 intentos → `DEAD`, cron cada minuto). Logs sin headers/body.
- Expiración QR: cron cada 5 min cancela `MP_QR` PENDING de >15 min (tolera 404).
- Polling transferencias: cursor `Setting.lastMpPollAt` + paginación (hasta 150 pagos); `MovimientoMP` es fuente de verdad anti-duplicados; reserva pre-venta anti-doble-confirm.
- **Salidas de billetera**: `GET /v1/payments/search` solo expone ingresos; los retiros (`payout`) vienen del **Reporte de Liberaciones** (`syncOutflows()`, cron `0 */6 * * *`, ventana 12 h + poll c/5 min tope 90 min). Ingesta solo SALIDAS (`DESCRIPTION=payout|withdrawal`, `NET_DEBIT>0`) como `MpAccountMovement RETIRO`; la fila `RECORD_TYPE=total` se guarda como saldo disponible MP (`Setting.mpDisponible`). El `file_name` real usa prefijo `reserve-null-manual-*`: tomarlo siempre de `list`.

**MP por caja**: con OAuth los `mpStoreId`/`mpPosId` se guardan en `Setting`; sin OAuth, `externalStoreId`/`externalPosId` en `User`. Cada `PosDevice` puede tener su propio POS de MP (ver Entradas).

## Finanzas / Tesorería (v2)

Módulo de caja y movimientos simple (reemplaza al antiguo Libro Diario de partida doble, migración `20261224000009_drop_legacy_accounting`). Accesible en `/admin/tesoreria` (solo ADMIN).

### Backend (`backend/src/modules/finanzas/`, `backend/src/modules/mp-auditoria/`)
- **MoneyAccount**: cuenta de caja (`EFECTIVO|MERCADOPAGO|BANCO|OTRO`) con saldo inicial. **MoneyCategory**: rubro (`INGRESO|EGRESO|AMBOS`, `grupo=OPERATIVO|FINANCIERO`). **Responsable**: ABM de responsables. **MoneyMovement**: movimiento (`INGRESO|EGRESO`) con `source` (`MANUAL|COBRO_FIADO|CUOTA_SOCIO|AJUSTE|VENTA|TRASPASO|MP_SYNC`).
- **Entradas automáticas**: cada `Sale APPROVED` (CASH/MP_QR/TRANSFER, no FIADO) crea un movimiento `source=VENTA` idempotente vía `FinanzasService.recordVenta()`; el reembolso lo anula (`voidVenta`). Los grupos `FINANCIERO` (Préstamos/Intereses/Cambio Caja) no entran al resultado operativo.
- **Traspasos**: `POST /finanzas/traspasos` crea par EGRESO/INGRESO con `transferGroupId`.
- **Endpoints**: `GET/POST /finanzas/accounts`, `PATCH /finanzas/accounts/:id`, `GET/POST /finanzas/categories`, `PATCH /finanzas/categories/:id`, `GET /finanzas/summary`, `GET /finanzas/categories/:id/detail`, `GET/POST /finanzas/movements`, `POST /finanzas/movements/:id/anular`, `GET /finanzas/monthly`, `POST /finanzas/traspasos`, `POST /finanzas/backfill-ventas`, `GET/POST /finanzas/responsables`, `PATCH /finanzas/responsables/:id/toggle`.
- **Auditoría MP** (`mp-auditoria`): `MpAccountMovement` es un snapshot de `GET /v1/payments/search` (upsert por `mpPaymentId`; tipos COBRO_QR/TRANSFERENCIA/RETIRO/GASTO/FEE/REFUND/CHARGEBACK) + puente `MpConciliacion` (1:N a Sale/MoneyMovement) + `MpSyncJob`. Sync: cron horario + 1× por sesión + botón manual; backfill por semanas con corte default `2026-10-01`. Auto-match por `externalReference sale-/ticket-`, `mpPaymentId` o monto±ventana (→ SUGERIDO). `GET /mp-auditoria/balance` calcula el saldo desde los movimientos del sistema (la API pública no expone saldo con el OAuth actual). Categorizar un movimiento crea un `MoneyMovement MP_SYNC`.
- **Endpoints MP**: `GET /mp-auditoria`, `/status`, `/balance`, `/:id`; `POST /sync`, `/backfill`, `/reconciliar`, `/release-sync`, `/:id/vincular`, `/:id/categorizar`, `/:id/ignorar`, `/:id/desvincular`.

### Frontend (`TreasuryLayout.tsx`)
Tabs: **Resumen** (`FinanzasResumenPage`) | **Efectivo** (`EfectivoPage`, agrupa ventas con `?groupVentas=1`) | **Auditoría MP** (`MpAuditoriaPage`) | **Configuración** (`FinanzasCuentasPage` + rubros + responsables). Rutas legacy `/admin/contabilidad/*` y `/admin/tesoreria/movimientos|cuentas|reportes|gastos` redirigen.

## Socios / Padrón de Socios

Accesible en `/admin/socios`. Modelo: `SocioTipo → Socio → SocioCuota → SocioPago`, `SocioTipo → SocioBeneficio → SocioCanje`, `Socio → SocioCanje`.

- **CRUD** `/socios` con filtros (`?estado=`, `?socioTipoId=`, `?deuda=`); soft delete a INACTIVO.
- **Cuotas**: `POST /socios/cuotas/generar {anio,mes}` (idempotente, un registro por socio ACTIVO con el `montoMensual` de su tipo); `POST /socios/cuotas/:cuotaId/pagar`; matriz anual `GET /socios/reporte/matriz?anio=`.
- **Tipos**: `GET/POST/PUT/DELETE /socios/tipos`.
- **Beneficios** (`socios-beneficios`): descuentos % por tipo de socio sobre categoría o producto, con `descuentoMaximo` y `limiteDiario`. CRUD `/socios/beneficios` + `POST /socios/canjes`.
- **Carnets PDF**: individual `GET /socios/:id/carnet` (CR80 en A4) y masivo `POST /socios/carnets {ids[]}` (grilla 2×4 = 8 por A4). Fondo configurable `Setting.carnetBgUrl` (PNG 1028×650, subida `POST /settings/carnet-bg`, guard SOCIOS FULL).
- **QR**: `GET /socios/qr/:uuid` (usado por el POS). Al escanear el QR se aplican los beneficios automáticamente.
- KPIs: `GET /socios/tesoreria/resumen`.
- Frontend: `AdminSociosLayout` con tabs (Padrón, Matriz, Configuración, Beneficios) + `SocioQrModal` en el POS.

## Acreedores / Fiado

Ventas fiadas con control de saldo por acreedor (FIFO sobre `FiadoVenta.saldoRestante`). El POS vende con `paymentMethod: FIADO` + acreedor; pagos `POST /acreedores/:id/pagos` y ajustes `POST /acreedores/:id/ajustes`. Límites opcionales (`limiteDeuda` bloquea, `advertenciaDeuda` avisa) e intereses (`GET /acreedores/intereses/preview`, `POST /acreedores/intereses/aplicar`, config `interesAcreedoresHabilitado`/`tasaInteresMensualAcreedores`/`interesFechaAmnistia`).

- Toggle "Fiado" en Configuración → Ventas → Medios de pago (requiere `enableAcreedoresModule` y `enableFiadoPayment`).
- Frontend: `AdminAcreedoresPage` + `AdminAcreedorDetailPage`.

## Internet / Vouchers WiFi

Venta de vouchers WiFi respaldados por RADIUS (integra con `api-radius`, proyecto `~/internet-sale`, red Docker `soler_default`). `Setting.enableInternetModule`.

- **InternetPlan**: plan (nombre, duración, bandwidth, precio). Al crearlo genera un `Product` en la categoría "Internet" (icono = duración formateada). CRUD en `internet-plans.controller.ts`.
- **SaleVoucher**: voucher generado por venta (PIN, plan, activo). Se crea al confirmar el pago (CASH/FIADO inmediato, MP_QR por webhook, TRANSFER al confirmar) y se imprime en el ticket. Al anular la venta se desactivan.
- **StaffVoucher**: vouchers de personal (`internet/staff-vouchers`, `GET/POST/DELETE`), con `label`, `notes`, duración y bandwidth. Tercera solapa "Personal" en la página de Internet.
- **Checkout público** (`internet-public.controller.ts`): `GET /internet/public/status|plans`, `POST /internet/public/checkout`, `GET /internet/public/orders/:id` → `PublicInternetPage.tsx` (venta de vouchers sin login).
- **stats/health**: `GET /internet/vouchers/stats`, `GET /internet/vouchers/health`.
- Frontend `AdminInternetPage.tsx`: tabs **Vouchers** | **Planes** | **Personal** (estilo `treasury-subnav-link`).
- **IMPORTANTE**: el cliente usa `http.request` de Node (no `fetch`) porque `undici` falla al resolver DNS interno de Docker. La columna `radius.vouchers.sale_id` debe ser `VARCHAR(50)` (m-posw usa UUIDs).

## Jugadores / Torneos / DT's

Accesible en `/admin/players` (permiso `PLAYERS`, `enablePlayersModule`). Sub-nav: **Dashboard | Jugadores | DT's | Categorías | Torneos**.

- **Player**: datos personales (DNI único). **PlayerCategory**: por `AGE` (ageMin/ageMax + cutoff) o `BIRTH_YEAR`. **Tournament**: año, `allowedSex` M/F/X, rango de años, límites. **TournamentPlayer**: fichaje con categoría asignada automáticamente. **Coach** + **TournamentCoach**: cuerpo técnico (DT's) y fichaje de DT por torneo.
- Endpoints jugadores: `GET /players` (paginado, `?search=&sex=`), `GET /players/export`, `POST /players/import-excel` (multipart), CRUD `/players`.
- Categorías: CRUD `/player-categories` (bloquea delete si está en uso). Torneos: CRUD `/tournaments`, `GET /tournaments/:id/players`, `POST /tournaments/:id/players/eligible`, `POST /tournaments/:id/players {playerIds}` (ficha), `DELETE .../:playerId`.
- DT's: CRUD `/coaches` + `GET /coaches/report` (PDF) + `tournaments/:tournamentId/coaches` (asignar/quitar).
- Dashboard: `GET /players-stats/dashboard` (KPIs, fichados por torneo/categoría, cumpleaños próximos 20 días).
- Frontend en `pages/players/`: `PlayersLayout`, `index.tsx` (Dashboard), `PlayersPage`, `CoachesPage`, `PlayerCategoriesPage`, `TournamentsPage` + `TournamentPlayersModal`.

## Patrimonio / Bienes

Gestión de activos con historial inmutable. `/admin/patrimonio` (HIDDEN/READ/FULL). Modelo: `AssetCategory`, `AssetStatus` (2 del sistema: Activo/De Baja + intermedios), `Asset`, `AssetEvent` (`ALTA|MODIFICACION|CAMBIO_ESTADO|BAJA`).

- Endpoints: CRUD `/assets` (baja lógica vía `DELETE`, cambio de estado `PATCH /assets/:id/status`); historial `GET /assets/:id/events`; CRUD `/asset-categories` (+toggle) y `/asset-statuses` (edita/toggle/delete solo si `isSystem=false`).
- Reglas: bienes nunca se eliminan físicamente; un bien dado de baja no se reactiva; no se permite desactivar categorías con bienes activos; estados del sistema devuelven 403 en edición/toggle/delete.
- Frontend en `pages/patrimonio/` (Bienes + Config). `Setting.enablePatrimonioModule` (default true).

## Notificaciones / WhatsApp

Módulo genérico de notificaciones con **WhatsApp** como proveedor (`backend/src/modules/notificaciones/`). `Setting.enableNotificationsModule` (default false).

- **Dos modos**: **API** (`whatsappUseApi=true`, WhatsApp Cloud API / Graph v21 con `whatsappPhoneNumberId` + `whatsappAccessToken` + `whatsappAppSecret`) o **Web** (`whatsappUseApi=false`, genera un enlace `wa.me` con `whatsappWebMessage`); en modo web el envío por API se rechaza.
- **Plantilla** configurable con variables `{{nombre}}`, `{{saldo}}`, `{{dias}}`, `{{club}}` (orden configurable vía `whatsappVariableOrder`).
- **Cola**: `NotificationJob` (QUEUED→PROCESSING→SENT/FAILED/CANCELLED) procesada secuencialmente a 1 msg/s; `NotificationLog` registra cada intento. Reintentos, pausa/reanudar y cancelación desde la GUI.
- **Conversaciones/chat**: `WhatsAppConversation` + `WhatsAppMessage` (INBOUND/OUTBOUND, texto/imagen/audio/sticker). Webhook público `GET/POST /webhooks/whatsapp`. Botón con badge de no leídos en `AppHeader` (`GET /notificaciones/conversations/unread-count`, polling 10s).
- Endpoints principales: config/test/history/queue, `GET /notificaciones/conversations[/:id/messages]`, `POST .../send`, `POST .../read-all`, `DELETE` mensajes/conversaciones, `GET /notificaciones/media/:messageId`. En Acreedores: `/acreedores/:id/notificar-deuda` (+batch) `GET .../notificaciones`.
- Frontend: `AdminNotificacionesPage.tsx` (tabs Configuración | Historial | Conversaciones) + `notificaciones/{MediaBubble,LightboxModal}`.

## Entradas / POS Externo

Venta de entradas y POS bufet desde terminal Android (Sunmi V2s o equipo genérico con impresora BT 58mm). Opera **fuera del VPS** por HTTPS (`https://${CADDY_HOST}/api/entradas/...` vía Caddy → nginx → backend). `Setting.enableEntradasModule` (default false).

### Estructura y modelos (`backend/src/modules/entradas/`)
- **EntradaTorneo** (nombre + precio único), **EntradaRival**, **EntradaFixture** (fecha + torneo + rival + `ventanaDesde/Hasta`, default 06:00→05:59+1; `@@unique(fecha,torneoId,rivalId)`).
- **PosDevice**: token `ent_...` (hash SHA256, se muestra una vez + pairing `{baseUrl, token}` para QR). Revocable/rotatable. `tipo` ENTRADAS|POS y **MP propio** (`mpStoreId/mpPosId/mpQrData`, obligatorio para QR, sin fallback). Se gestiona en **Sistema → Dispositivos** (`/admin/dispositivos`, CONFIGURACION).
- **Usuario `pos-terminal`** (seed, POS FULL, sin login): atribuye ventas de terminales.
- **TicketSale** → **TicketUnit**: `sector` informativo, `cantidad` 1-10; CASH aprueba directo, MP_QR crea orden Instore (`externalReference=ticket-<id>`) en el POS del device. Numeración `L-001`/`V-001` por partido y sector (contador atómico anti-doble-aprobación). `requestId` = idempotencia.
- **EntradaBeneficio** + `EntradaBeneficioConsumo`/`Validacion`: descuento % de bufet (global o por sector, `usoUnico`), canje con QR `ENT:<code>`.
- **EntradaTicketTemplate** + **EntradaTicketAsset** (escudo PNG 1-bit): layout JSON versionado, cacheado por versión en el terminal.

### Endpoints (web + device)
- Admin (JWT, `RequireModule ENTRADAS`): CRUD torneos/rivales, fixtures (`?from=&to=`), ventas (`/entradas/sales?fixtureId=`, `/summary`), beneficios (CRUD + validar/consumir), ticket-template/escudo.
- Device (`EntradasDeviceGuard`, Bearer `ent_...`): `GET /entradas/fixtures/vigentes` (alias `/hoy`), `POST /entradas/sales/intent`, `GET /entradas/sales/:id/status`, `POST /entradas/sales/:id/cancel`, `GET /entradas/socios/:uuid`, beneficios.
- POS bufet (`@DeviceKind pos`): `GET /pos-device/catalog`, `/acreedores`, `/settings`, `/mp-qr`; `POST /pos-device/sales/{cash,qr,fiado}`, `GET /pos-device/sales/:id[/status]`, `POST .../cancel`, `.../ticket-printed`, `POST /pos-device/socios/canjes`.
- Dispositivos (CONFIGURACION): `GET /dispositivos` (+`/mp-stores`), `POST /dispositivos`, `PATCH /:id/tipo`, `POST /:id/{revoke,rotate,mp-select,mp-setup,mp-disconnect}`.
- Shared: `GET /entradas/ticket-template`, `/entradas/ticket-assets/escudo` (JWT o device, FlexibleGuard).

### Webhook MP
`MercadoPagoWebhookProcessorService` deriva `externalReference` prefijo `ticket-` a `EntradasSalesService` (vía `ModuleRef` lazy): aprueba y genera `L-/V-`, registra `SocioCanje` si hubo descuento.

### APK terminal (`m_posw_entradas/`, dual ENTRADAS/POS, README propio)
- Paquetes `ui/entradas/` y `ui/pos/` sin imports cruzados (CI lo verifica). Común: `data/` (ApiClient/SessionManager/ModeResolver), `printer/`, Scanner, Config.
- **Modo**: `GET devices/me` en arranque, `onResume`, ticker 60s y ante 403 → cambia de pantalla solo. Offline usa el último conocido.
- **Room**: `entradas.db` solo en ENTRADAS; `pos.db` solo en POS. Sin `Application` custom (RAM 1GB).
- **Impresión**: `PrinterRouter` automático (Sunmi AIDL si el equipo lo trae, si no BT 58mm ESC/POS configurada en Config → Impresora). Sin impresora la venta aprueba igual y queda para reimprimir.
- **POS UI**: dash con fotos (caché propia `<id>_<imageUpdatedAt>.webp` en filesDir + snapshot Room + RGB_565), carrito lateral colapsable en tablet apaisada (`sw600dp-land`, panel compartido con el slide-up de teléfono), pay-sheet según Setting (CASH exacto / QR / Fiado, sin transferencia), escaneo único (UUID→socio, `ENT:`→beneficio), escala S/M/L (tarjeta fija 140/180/220dp, foto cuadrada; el span sale de métricas de ventana). Últimas de Entradas solo del día. UI v2 M3 claro/oscuro con `AccentTheme` (semilla = `accentColor`).
- **Config** por pestañas: Estado (modo, impresora, sello, fotos) | Conexión | Impresora | Apariencia.
- **Sello de versión** `vX.Y.Z (sha)` (`BuildConfig.GIT_SHA`). **CI** `.github/workflows/build-apk.yml` (tag `terminal-latest` solo desde main; en branches solo verifica; package-separation check).
- **Límites v1**: una orden QR activa por POS de MP; transferencia discontinuada en terminales; `SocioCanje.usuarioId` nullable (`posId` = deviceId).

## Home / Dashboard (`/admin/home`)

`GET /home/metrics` devuelve KPIs por módulo según permisos: `pos` (ventas hoy/ayer/semana), `socios` (activos, cuotas vencidas), `acreedores` (deuda/crédito), `internet` (vouchers activos/vencen hoy), `stock` (productos/categorías). Frontend `HomePage.tsx`.

## UI/UX — Sistema de diseño (DESIGN.md)

`DESIGN.md` es la fuente de verdad; la implementación vive en `frontend/src/components/ui/` y `frontend/src/styles/tokens.css`.

- **Tokens**: `--color-primary` (acento configurable, inyectado por `AppLayout` vía `utils/accent.ts` con `on-primary` por luminancia) + derivados `color-mix`, semánticos `*-soft`, tipografía por rol, espaciado, radios, sombras, `--control-h` (40px; 44px en `pointer:coarse`), `--content-max: 1400px`.
- **Componentes**: `PageLayout/PageHeader`, `Tabs`/`RouteTabs`, `KpiGrid/KpiCard`, `Badge`, `Button`/`Fab`, `Input/Select/DateInput/Textarea/MoneyInput/SearchInput/SegmentedControl/FormField/FormGrid/IconPicker`, `DataTable`, `Modal`/`ConfirmDialog`, `Card/Toolbar/ListError/Delta`.
- **Formato** (`utils/format.ts`, `es-AR`): `formatMoney`, `formatPercent`, `formatDate`, `formatDateTime`, `formatDateLong`, `formatNumber`. Prohibido formatear fuera de ahí.
- **Accesibilidad**: contraste 4,5:1 texto / 3:1 iconos, táctil 44px en coarse, `:focus-visible`, `aria-label` en botones de ícono, `ConfirmDialog` antes de eliminar, `Toast` con `aria-live`.
- **Theming**: tema claro (default) / oscuro, toggle en el header persistido en `localStorage`, respeta `prefers-color-scheme`.
- **Reglas al tocar UI**: un `primary` por zona, estados con color semántico + texto (nunca solo color), verificar `npm run build` en `frontend/`.

Pendientes conocidos (ver `TODO.md`): migrar tablas legacy (`.sales-table`) a `DataTable` y modales legacy a `ui/Modal`; filtros por URL en Socios/Acreedores/Internet; endpoint dedicado de últimos movimientos.

## Important Constraints

- **Migraciones**: se aplican automáticamente al iniciar el backend. No ejecutar manualmente en producción sin necesidad.
- **Seed**: corre si `RUN_SEED=1` (no está en docker-compose por defecto).
- **CORS**: `CORS_ORIGIN` debe incluir el protocolo.
- **Uploads**: volumen `uploads_data`, servidos por el backend en `/uploads`.
- **Prisma Client**: se regenera en el build de Docker.
- **OAuth**: requiere `INSTANCE_SUBDOMAIN`, `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI`. Webhook: `https://${INSTANCE_SUBDOMAIN}.mposw.com.ar/api/webhooks/mercadopago`.
- **Sidebar**: colapsable, estado en `localStorage`, breakpoint responsive en 1200px.

## Testing

Backend usa Jest con ts-jest (`*.spec.ts`): `cd backend && npm test`. Sin suite configurada para frontend ni Android.

## Useful Scripts

| Script | Descripción |
|--------|-------------|
| `deploy.sh` | Deploy completo: pull, build, up |
| `limpiar-datos-operativos.sh --yes` | Reset de datos operativos |
| `backend/scripts/check-prisma-fk-types.js` | Validación de tipos FK en Prisma |

## File Structure

```
m-posw/
├── backend/                       # NestJS + Prisma
│   ├── src/modules/
│   │   ├── acreedores/            # Fiado (FIFO) + notificaciones de deuda
│   │   ├── auth/                  # JWT
│   │   ├── cash-close/            # Cierres de caja
│   │   ├── categories/ products/  # Productos + recetas + stock
│   │   ├── coaches/               # DT's + fichaje por torneo
│   │   ├── common/                # Prisma, MP config, guards, uploads
│   │   ├── entradas/              # POS externo (devices, fixtures, L/V, template)
│   │   ├── finanzas/              # Caja/movimientos (v2)
│   │   ├── home/                  # KPIs del home
│   │   ├── icons/                 # Iconos
│   │   ├── internet-vouchers/     # Vouchers WiFi + staff + checkout público
│   │   ├── mercadopago-oauth/     # OAuth 2.0 MP
│   │   ├── mp-auditoria/          # Auditoría MP + conciliación + salidas
│   │   ├── notificaciones/        # WhatsApp (API/web) + conversaciones
│   │   ├── patrimonio/            # Bienes + historial
│   │   ├── payments/              # Transferencias (polling MP)
│   │   ├── player-categories/ players/ players-stats/ tournaments/
│   │   ├── sales/                 # Ventas + MP Instore + webhooks + WS
│   │   ├── settings/ socios/ stats/ stock/ users/
│   ├── prisma/                    # schema + migrations + seed
│   ├── scripts/                   # Utilidades
│   └── Dockerfile
├── frontend/                      # React + Vite
│   ├── src/{api,components,context,hooks,pages,styles,utils}/
│   ├── public/about.md
│   ├── nginx.conf
│   └── Dockerfile
├── m_posw_entradas/               # APK terminal Kotlin (ENTRADAS/POS)
├── m_posw_android/                # APK Flutter legacy (WebView)
├── docker-compose.yml
├── .env.example
├── DESIGN.md / README.md / INFRAESTRUCTURA.md / TODO.md
└── deploy.sh
```

## Common Issues

1. **Red Docker**: crear `shared_proxy` (`docker network create shared_proxy`).
2. **CORS**: `CORS_ORIGIN` debe coincidir exacto con la URL del frontend.
3. **Webhooks MP no llegan**: endpoint público + `MP_WEBHOOK_SECRET` si el strict está activo.
4. **QR no genera**: `externalStoreId`/`externalPosId` del usuario/caja (o usá OAuth). En terminales, vincular MP al `PosDevice` (si no → `MP_POS_NOT_LINKED`).
5. **OAuth no funciona**: revisar `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` y `INSTANCE_SUBDOMAIN`.
6. **Sidebar no colapsa**: limpiar `localStorage`.
7. **WhatsApp no envía**: revisar credenciales en `/admin/notificaciones` y si el modo API está activo (`whatsappUseApi`); `docker compose logs backend`.
8. **Vouchers WiFi**: verificar `VOUCHER_API_URL` y conectividad a `api-radius:3001` (red `soler_default`).
</content>

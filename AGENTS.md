# AGENTS.md — m-POSw

Mini POS Web: Sistema de punto de venta para eventos/jornadas. Stack: React + Vite (frontend), NestJS + Prisma (backend), PostgreSQL (DB), Flutter (Android APK).

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (React+Vite) │  Backend (NestJS)  │  PostgreSQL  │
│  Port: 8080            │  Port: 3000        │  Port: 5432  │
└────────────────────────────────────────────────────────────┘
```

- **Frontend**: Nginx serves static build. Proxy `/api/*` and `/uploads/*` to backend.
- **Backend**: Auto-runs `prisma migrate deploy` on container start (see `docker-entrypoint.sh`).
- **Android APK**: Flutter WebView que carga el frontend + impresión Bluetooth nativa.

## Quick Start (Docker)

```bash
# 1. Configurar

cp .env.example .env
# Editar todas las variables requeridas

# 2. Levantar todo
docker compose up -d --build

# 3. URLs
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
```

**Prerequisito**: La red Docker `shared_proxy` debe existir:
```bash
docker network create shared_proxy
```

## Environment Variables (Required)

Ver `.env.example` para el listado completo. Las críticas:

| Variable | Propósito |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Firma de tokens JWT |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciales del admin inicial (seed) |
| `CORS_ORIGIN` | Origen permitido para CORS |
| `VITE_API_BASE_URL` | `/api` (con proxy) o URL completa del backend |
| `MP_ACCESS_TOKEN` / `MP_COLLECTOR_ID` | Mercado Pago (opcionales si usás OAuth) |
| `MP_DEFAULT_EXTERNAL_STORE_ID` / `MP_DEFAULT_EXTERNAL_POS_ID` | IDs de Store/POS en MP (opcionales si usás OAuth) |
| `MP_WEBHOOK_SECRET` | Validación de webhooks de MP |
| `INSTANCE_SUBDOMAIN` | Subdominio usado para construir URL de webhook dinámica |
| `CADDY_HOST` | Host público de la instancia para Caddy (`docker-compose.yml` label). El POS externo pega a `https://${CADDY_HOST}/api/entradas/...` |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Credenciales para OAuth Mercado Pago |
| `MP_OAUTH_REDIRECT_URI` | URI de callback para OAuth |
| `MP_INTEGRATOR_ID` | Integrator ID opcional (header X-Integrator-Id) |

## Authentication & Permissions

### Login

Login unificado por `username` + `password`. El endpoint `POST /auth/login` devuelve:
- `accessToken`: JWT (payload: `userId`, `role`, `username`)
- `user`: datos del usuario
- `homeModule`: módulo al que redirige post-login (null = `/home`)
- `permissions`: lista de `{ module, access }` para el usuario (vacío para ADMIN)

### Roles

- **ADMIN**: acceso FULL implícito a todos los módulos. No tiene registros en `UserModulePermission`.
- **USER**: acceso configurable por módulo vía `UserModulePermission`.

### Módulos y niveles de acceso

| Módulo | ModuleKey | Niveles |
|--------|-----------|---------|
| POS | `POS` | HIDDEN, FULL (no acepta READ) |
| Socios | `SOCIOS` | HIDDEN, READ, FULL |
| Tesorería | `TESORERIA` | HIDDEN, READ, FULL |
| Acreedores | `ACREEDORES` | HIDDEN, READ, FULL |
| Internet | `INTERNET` | HIDDEN, READ, FULL |
| Jugadores | `PLAYERS` | HIDDEN, READ, FULL |
| Patrimonio | `PATRIMONIO` | HIDDEN, READ, FULL |
| Stock | `STOCK` | HIDDEN, READ, FULL |
| Reportes | `REPORTES` | HIDDEN, READ, FULL |
| Configuración | `CONFIGURACION` | HIDDEN, READ, FULL |
| Entradas | `ENTRADAS` | HIDDEN, READ, FULL |

- **HIDDEN**: no aparece en sidebar, no accesible vía URL
- **READ**: visible, datos cargados, sin botones de crear/editar/eliminar
- **FULL**: acceso completo

### Permisos en el frontend

- Hook `useModuleAccess(moduleKey)` → `'HIDDEN' | 'READ' | 'FULL'`
- Componente `ModuleRoute` protege rutas; redirige a `/home` si módulo oculto
- Sidebar se construye dinámicamente según permisos
- Home page (`/home`) muestra grilla de módulos accesibles

### Guard de backend

- `ModuleAccessGuard` + decorador `@RequireModule(ModuleKey, MinAccess)`
- El ADMIN bypasea cualquier verificación

### Gestión de usuarios

- `GET /users` — lista con permisos y homeModule
- `POST /users` — crear con `{ username, password, homeModule?, permissions[] }`
- `PATCH /users/:id` — editar usuario y permisos
- `DELETE /users/:id` — no permite eliminar al admin
- Solo ADMIN puede gestionar usuarios. Los permisos del admin no se modifican.

## Developer Commands

### Backend (from `backend/`)

```bash
# Tests
npm test                    # Jest, busca *.spec.ts

# Prisma
npx prisma migrate dev      # Crear nueva migración
npx prisma migrate deploy   # Aplicar migraciones (auto en Docker)
npx prisma db seed          # Seed (ejecuta `prisma/seed.ts`)
npx prisma studio           # GUI de Prisma

# Build/Run
npm run build               # Nest build
npm run start:dev           # Modo watch
npm run start               # Producción (node dist/main.js)
```

### Frontend (from `frontend/`)

```bash
npm run dev                 # Vite dev server
npm run build               # tsc + vite build
npm run preview             # Preview build de producción
```

### Android APK (from `m_posw_android/`)

```bash
flutter build apk --release
```

### Docker Compose

```bash
docker compose up -d --build
docker compose logs -f backend
docker compose logs -f frontend
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

### Deployment

```bash
./deploy.sh                 # git pull + rebuild + up
```

## Database Operations

### Reset completo (desarrollo)

```bash
cd backend
npx prisma migrate reset --force
```

### Limpiar datos operativos (conserva usuarios/config)

```bash
./limpiar-datos-operativos.sh --yes
```

Elimina: ventas, movimientos manuales, cierres de caja, sesiones, fiado_ventas, pagos_acreedor.
Conserva: usuarios, configuración, categorías, productos, acreedores, socios.

## Mercado Pago Integration

**Tres métodos / flujos:**

1. **QR (Instore v2)**: Webhook async a `/webhooks/mercadopago`. Requiere credenciales MP (OAuth o .env) y Store/POS configurados.

2. **Transferencia (CVU/Alias)**: Polling automático a la API de MP. **No usa webhooks**. El frontend consulta periódicamente pagos recientes.

3. **OAuth 2.0**: Vinculación de cuenta MP sin tokens manuales. Flujo completo: autorización → intercambio de código → tokens guardados en tabla `Setting`. Renovación automática cada 6 horas vía cron. Detección de tiendas/POS existentes y creación automática de POS QR.

**Endpoints relevantes:**
- `POST /sales/:id/payments/mercadopago-qr` — Crear orden QR
- `POST /sales/:id/payments/mercadopago-qr/cancel` — Cancelar orden
- `POST /payments/transfer/poll` — Buscar transferencias pendientes
- `POST /payments/transfer/confirm` — Confirmar pago por transferencia
- `POST /mp-auditoria/release-sync` — Generar reporte de Liberaciones y traer salidas (retiros) de la billetera
- `POST /webhooks/mercadopago` — Webhook de MP
- `GET /mp-oauth/connect` — Generar URL de autorización OAuth
- `POST /mp-oauth/token` — Intercambiar código por tokens
- `GET /mp-oauth/status` — Estado de vinculación OAuth
- `DELETE /mp-oauth/disconnect` — Desvincular cuenta MP
- `GET /mp-oauth/detect-stores` — Listar tiendas/POS de la cuenta
- `POST /mp-oauth/select-store` — Seleccionar tienda existente
- `POST /mp-oauth/setup-pos` — Crear tienda + POS automáticamente

**Token resolution flow:**
```
MercadoPagoConfigService.getAccessToken()
  ├── ¿Token OAuth en DB (Setting.mpAccessToken)?
  │   ├── ¿Por vencer en < 5 min? → refrescar vía callRefreshApi()
  │   └── Retornar token OAuth
  └── Fallback: MP_ACCESS_TOKEN del .env
```

**Configuración MP por caja**: Con OAuth, los `mpStoreId`/`mpPosId` se guardan en `Setting`. Sin OAuth, los campos `externalStoreId`/`externalPosId` en `User` deben coincidir con los configurados en el dashboard de MP.

**Estado actual (post-homologación 2026-09-28, deployado en prod):**
- SDK oficial `mercadopago@3.6.1`: `getPayment` y reembolsos vía SDK. El PUT/DELETE de órdenes Instore QR sigue por `fetch` (el SDK no cubre ese endpoint) con `X-Idempotency-Key = <external_reference>:<uuid>` por intento + retry `500/1500/3000ms+jitter` solo en `429/5xx/timeout/red`.
- Entornos separados: `MP_ENV=test|live` (inferido por prefijo `TEST-`/`APP_USR-` si se omite). `MP_TEST_ACCESS_TOKEN` / `MP_LIVE_ACCESS_TOKEN` con fallback legacy `MP_ACCESS_TOKEN`. Fail-fast: token `TEST-` en `live` frena el arranque. Entorno visible en `GET /mp-oauth/status`.
- Reembolsos: `POST /sales/:id/refund` (solo ADMIN, `MP_QR` aprobada, total). Revierte stock atómico + desactiva vouchers. `PaymentStatus` incluye `REFUNDED` / `CHARGEBACK` (reportes los agrupan como `REJECTED`). Límite v1: reembolsos desde el panel de MP llegan por webhook sin reversión de stock.
- Webhook: estricto siempre en producción (`merchant_order` igual que `payment`), tolerancia `ts` 300s anti-replay, fail-closed sin secret. Sin Redis a propósito: cola persistente en tabla `WebhookRetry` (backoff `5s/30s/2m/10m/30m`, 5 intentos → `DEAD` manual, cron cada minuto). Logs recortados (sin headers/body).
- Expiración QR: cron cada 5 min cancela `MP_QR` + `PENDING` + `>15min` (tolera 404 de MP).
- Polling transferencias: cursor persistido `Setting.lastMpPollAt` + paginación (hasta 150 pagos), `movimientoMP` como fuente de verdad anti-duplicados (sobrevive reinicios). Reserva pre-venta anti-doble-confirm concurrente.
- **Salidas de billetera vía Reporte de Liberaciones (desde 2026-10-02):** `GET /v1/payments/search` solo expone ingresos; los retiros (`payout`) se traen del **Reporte de Liberaciones**, único endpoint financiero autorizado con el OAuth actual (balance/money_events/reports/settlement dan 403/404). Flujo por instancia (token OAuth de su cliente): config única `POST /v1/account/release_report/config` (columnas DATE/SOURCE_ID/EXTERNAL_REFERENCE/RECORD_TYPE/DESCRIPTION/NET_DEBIT_AMOUNT/NET_CREDIT_AMOUNT) → en cada sync `POST /v1/account/release_report` (ventana últimas 12 h) → poll `GET /v1/account/release_report/list` c/5 min (tope 90 min, condición real `status=enabled` con `file_name`) → `GET /v1/account/release_report/{file_name}` (CSV). Solo ingesta **SALIDAS** (`DESCRIPTION=payout|withdrawal`, `NET_DEBIT>0`), ignora `reserve_*` (netean a 0) y créditos (entradas ya cubiertas); upsert idempotente en `MpAccountMovement` (`mpPaymentId=SOURCE_ID`, tipo `RETIRO`, PENDIENTE) → categorizar crea `EGRESO MP_SYNC`. Cron `0 */6 * * *` + botón manual. El `file_name` real usa prefijo `reserve-null-manual-*` (no respeta el configurado): siempre tomarlo de `list`. Generación tarda ~20-30 min.
- `docs/guia-testing-integracion-mp.md` y `docs/mercadopago-transfer-confirmation.md` se eliminaron (2026-09-28) por obsoletos; esta sección es la referencia vigente.

## Treasury / Tesorería Module

Módulo de contabilidad con partida doble. Accesible desde `/admin/tesoreria` (solo ADMIN).

### Estructura
```
backend/src/modules/treasury/
├── treasury.module.ts
├── ledger-accounts.controller.ts    # CRUD plan de cuentas
├── ledger-accounts.service.ts       # Árbol jerárquico, queries por tipo
├── journal-entries.controller.ts    # CRUD asientos + income/expense simplificados
├── journal-entries.service.ts       # Numeración auto, validación balance, reversión
├── reports.controller.ts            # Reportes + exportación Excel
├── reports.service.ts               # Libro Diario, Mayor, Balance, Resultados, Disponibilidades
└── dto/
```

### Conceptos clave
- **LedgerAccount**: Cuentas jerárquicas (ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE). `acceptsEntries: false` = cuenta agrupadora.
- **JournalEntry**: Asientos con estados DRAFT → POSTED → VOIDED. Validación: Σ Débito = Σ Crédito (tolerancia 0.005).
- **Voiding**: Crea asiento de reversión (invierte débitos/créditos), marca original como VOIDED.
- **Simple entries**: `POST /entries/income` y `POST /entries/expense` para registros rápidos (2 cuentas).
- **Reportes exportables**: ExcelJS genera .xlsx de todos los reportes.

### Frontend
```
frontend/src/pages/
├── TreasuryLayout.tsx              # Layout con sub-navegación
├── TreasurySummaryPage.tsx         # Dashboard: disponibilidades, ingresos/egresos, últimos asientos
├── TreasuryJournalEntriesPage.tsx  # CRUD de asientos + Excel
├── TreasuryLedgerAccountsPage.tsx  # Árbol de cuentas
└── TreasuryReportsPage.tsx         # 5 tabs de reportes + exportación
```

**Rutas legacy** (`/admin/contabilidad/*`) redirigen automáticamente a `/admin/tesoreria/*`.

### Tesorería v2 (Finanzas + Auditoría MP, vigente desde 2026-10-01, corte 01/10/26)

Tabs en `TreasuryLayout`: `Resumen | Efectivo | Auditoría MP | Configuración` (rutas `/admin/tesoreria/*`, legacy `movimientos/cuentas` redirigen).

- **Entradas automáticas**: cada `Sale APPROVED` (CASH/MP_QR/TRANSFER, no FIADO) crea un `MoneyMovement source=VENTA/sourceId=sale.id` idempotente vía `FinanzasService.recordVenta()` (hooks: `createCashSale`, `completeSale`, `confirmTransfer`, webhook approve, `refunds → voidVenta`). Las filas virtuales `VENTA_DIARIA` se eliminaron; el tab Efectivo agrupa con `?groupVentas=1` (grupos colapsables por día).
- **MoneyMovement**: suma `concepto`, `observaciones`, `responsableId` (ABM `Responsable`), `transferGroupId`. `MoneyCategory.grupo = OPERATIVO|FINANCIERO` (Préstamos/Intereses/Cambio Caja = FINANCIERO, no entran al resultado operativo). `MoneyMovementSource += VENTA|TRASPASO|MP_SYNC`.
- **Traspasos**: `POST /finanzas/traspasos` crea par EGRESO/INGRESO con mismo `transferGroupId` (categoría `Cambio Caja`).
- **Auditoría MP** (`backend/src/modules/mp-auditoria/`): tabla `MpAccountMovement` (snapshot `GET /v1/payments/search`, upsert por `mpPaymentId`, tipos COBRO_QR/TRANSFERENCIA/RETIRO/GASTO/FEE/REFUND/CHARGEBACK) + puente `MpConciliacion` (1:N a Sale/MoneyMovement) + `MpSyncJob`. Sync: cron horario `0 * * * *` + 1× por sesión (frontend `sessionStorage`) + botón manual. Backfill por semanas `POST /mp-auditoria/backfill {from}` (corte default `2026-10-01`). `GET /mp-auditoria/balance` calcula el saldo MP desde los movimientos del sistema (la API pública de MP no expone saldo con este OAuth: `/v1/account/balance` → 404, `mercadopago-accounts` → 403). Auto-match por `externalReference sale-/ticket-`, `mpPaymentId`, o monto±ventana (→ `SUGERIDO`). Categorizar crea `MoneyMovement MP_SYNC` en cuenta Mercado Pago. **Salidas**: los retiros de la billetera entran por el Reporte de Liberaciones (`syncOutflows()`, `POST /mp-auditoria/release-sync`, cron `0 */6 * * *`, ventana 12 h + poll c/5 min tope 90 min) como `MpAccountMovement RETIRO` (PENDIENTE) y se catalogan como `EGRESO` desde el modal. La fila `RECORD_TYPE=total` del reporte se guarda como **saldo disponible MP** (`Setting.mpDisponible/mpDisponibleAt`).
- **Configuración**: ABM cuentas (con saldo inicial), categorías (con grupo), responsables —con **modal único ver/editar/agregar** por entidad— + sección MP (corte `mpAuditSince`, traer histórico, saldo, más línea de **saldo disponible MP**). La pestaña **Auditoría MP** arranca con "Solo sin catalogar" **deshabilitado**. Resumen y Auditoría MP también muestran el saldo disponible.
- **Config**: `Setting.mpAuditEnabled/mpAuditSince/mpAuditCursor` + `releaseReportEnabled/lastOutflowSyncAt/mpDisponible/mpDisponibleAt`. Migraciones `20261229000002_auditoria_mp`, `20261001000000_release_report_outflows`, `20261002000000_mp_disponible`.

## Socios / Padrón de Socios Module

Módulo integral de gestión de socios para clubes e instituciones. Accesible desde `/admin/socios` (solo ADMIN).

### Estructura
```
backend/src/modules/socios/
├── socios.module.ts
├── socios.controller.ts              # CRUD socios + cuotas + tipos + carnets
├── socios.service.ts                 # Lógica de negocio + generación de carnets PDF
├── socios-qr.controller.ts           # Endpoint QR: GET /socios/qr/:uuid
├── socios-qr.service.ts              # Búsqueda de socio por UUID para escaneo QR
├── socios-beneficios.controller.ts   # CRUD de beneficios
├── socios-beneficios.service.ts      # Lógica de beneficios y canjes
└── dto/
    ├── create-socio.dto.ts
    ├── update-socio.dto.ts
    ├── create-socio-tipo.dto.ts
    ├── update-socio-tipo.dto.ts
    ├── create-socio-pago.dto.ts
    ├── generar-cuotas.dto.ts
    ├── create-beneficio.dto.ts
    ├── update-beneficio.dto.ts
    ├── create-canjes.dto.ts
    └── bulk-carnets.dto.ts
```

### Modelo de datos
```
SocioTipo ──1:N──> Socio ──1:N──> SocioCuota ──1:N──> SocioPago
SocioTipo ──1:N──> SocioBeneficio ──1:N──> SocioCanje
Socio ──1:N──> SocioCanje
SocioBeneficio ──N:1──> Category (categoriaProdId, optional)
SocioBeneficio ──N:1──> Product  (productoId, optional)
```

- **SocioTipo**: categoría de socio (ej: Activo, Vitalicio, Cadete). Define `montoMensual`.
- **Socio**: datos personales (nombre, apellido, DNI, UUID para QR, nroSocio). Estado: ACTIVO/INACTIVO/SUSPENDIDO.
- **SocioCuota**: cuota mensual generada por `POST /socios/cuotas/generar`. Estado: PENDIENTE/ PARCIAL/ PAGADO.
- **SocioPago**: pago aplicado a una cuota. Un pago por registro.
- **SocioBeneficio**: descuentos por tipo de socio sobre categorías o productos específicos. Campos: porcentaje, descuentoMaximo, limiteDiario.
- **SocioCanje**: registro de uso de un beneficio en una venta. Relacionado a la venta vía `ventaId`.

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/socios` | Lista todos con filtros (`?estado=`, `?socioTipoId=`, `?deuda=con-deuda\|al-dia`) |
| `POST` | `/socios` | Crear socio |
| `GET` | `/socios/:id` | Detalle de un socio |
| `PUT` | `/socios/:id` | Editar socio |
| `DELETE` | `/socios/:id` | Desactivar socio (soft delete → INACTIVO) |
| `GET` | `/socios/:id/cuotas` | Cuotas del socio |
| `GET` | `/socios/:id/carnet` | Generar PDF de credencial individual (CR80 en A4) |
| `POST` | `/socios/carnets` | Generar PDF con múltiples credenciales. Body: `{ ids: number[] }`. Grilla 2×4 (8 por hoja A4). |
| `POST` | `/socios/cuotas/generar` | Generar cuotas masivas para un mes/año. Body: `{ anio, mes }` |
| `POST` | `/socios/cuotas/:cuotaId/pagar` | Registrar pago de cuota. Body: `{ monto, fecha, observacion? }` |
| `GET` | `/socios/tipos` | Listar tipos de socio |
| `POST` | `/socios/tipos` | Crear tipo de socio. Body: `{ nombre, montoMensual }` |
| `PUT` | `/socios/tipos/:id` | Editar tipo de socio |
| `DELETE` | `/socios/tipos/:id` | Soft-delete tipo |
| `GET` | `/socios/tesoreria/resumen` | KPIs: `{ deudaTotal, sociosActivos, sociosConDeuda }` |
| `GET` | `/socios/reporte/matriz?anio=` | Matriz de cuotas por socio/mes para un año |
| `GET` | `/socios/qr/:uuid` | Buscar socio por UUID (usado por escáner QR del POS) |
| `GET` | `/socios/beneficios` | Listar beneficios |
| `POST` | `/socios/beneficios` | Crear beneficio. Body: `{ socioTipoId, categoriaProdId?, productoId?, porcentaje, descuentoMaximo?, limiteDiario? }` |
| `PUT` | `/socios/beneficios/:id` | Editar beneficio |
| `DELETE` | `/socios/beneficios/:id` | Eliminar beneficio |
| `POST` | `/socios/canjes` | Registrar canje de beneficio en venta |

### Carnets / Credenciales
- **Individual**: `GET /socios/:id/carnet` → PDF con una credencial CR80 (85.6×54mm) centrada en A4.
- **Masivo**: `POST /socios/carnets` → PDF con grilla 2 columnas × 4 filas = 8 credenciales por hoja A4. Múltiples páginas automáticas. Orden alfabético.
- **Diseño** (`SociosService.drawCard`, escala HTML 1028×650 → CR80): fondo PNG a sangre + cabecera desde `clubName` (primera palabra en blanco + resto en rojo `#ff1d25`, negrita con sombra), logo 240px arriba-derecha, nombre del socio, separador rojo `#d71920`, bloque `Socio Nº` (6 dígitos) + Tipo/DNI/`Socio desde`, QR del `uuid` en caja blanca redondeada (262px) inf. derecha.
- **Fondo configurable**: `Setting.carnetBgUrl` (migración `20261230000000_add_carnet_bg`). Se sube PNG (ideal 1028×650, máx 10MB, resize `cover` con sharp) desde `/admin/socios/configuracion` → `POST /settings/carnet-bg` (guard `SOCIOS FULL`); quitar = `PATCH /settings {carnetBgUrl:null}` (borra archivo). Sin fondo: carnet en blanco con mismo layout. Límites de subida: multer 10MB + `client_max_body_size 12m` en `frontend/nginx.conf`.
- El escáner QR del POS (`SocioQrModal`) lee el UUID del socio desde cualquier QR impreso en el carnet.

### Beneficios y descuentos en el POS
- Al escanear el QR de un socio en el POS, se aplican automáticamente los beneficios (descuentos) asociados a su tipo de socio.
- Los beneficios pueden ser por categoría de producto o por producto específico.
- Límites configurables: `descuentoMaximo` (tope en $), `limiteDiario` (cantidad de usos por día).
- Los canjes se registran en `SocioCanje` con referencia a la venta.

### Frontend
```
frontend/src/pages/
├── AdminSociosPage.tsx       # Lista con KPIs, filtros, checkboxes de selección múltiple, barra de acciones flotante para carnets masivos, modales CRUD, detalle con cuotas y pagos
└── SocioQrModal.tsx          # Escáner QR en el POS para leer credenciales de socios
```

### Generación de cuotas
- `POST /socios/cuotas/generar` con `{ anio, mes }` genera una cuota para cada socio ACTIVO con el `montoMensual` de su tipo.
- Idempotente: no duplica cuotas ya existentes para el mismo mes/año/socio.

### Configuración relacionada
- `Setting.enableSociosModule` (default: true): toggle en Configuración → Módulos que oculta la entrada del menú y el botón QR del POS.

## Módulos del Sistema (Configuración)

Solapa "Módulos" en Configuración (entre Usuarios y Sistema) para habilitar/deshabilitar secciones del sistema:

| Setting | Default | Efecto al desactivar |
|---------|---------|---------------------|
| `enableSociosModule` | true | Oculta "Socios" del menú y el botón QR del POS |
| `enableTreasuryModule` | true | Oculta "Tesorería" del menú |
| `enableAcreedoresModule` | true | Oculta "Acreedores" del menú, el toggle Fiado en Ventas y el botón Fiado del checkout |
| `enableInternetModule` | false | Activa el módulo de Vouchers WiFi. Agrega "Internet" al menú, la categoría en el POS, y genera vouchers al vender planes de internet |
| `enablePlayersModule` | false | Activa el módulo de Jugadores. Agrega "Jugadores" al menú (sección Deportes). Gestión de jugadores, categorías por edad, torneos con fichaje |
| `enablePatrimonioModule` | true | Activa el módulo de Patrimonio. Agrega "Patrimonio" al menú (sección Administración). Registro y gestión de bienes/activos con historial de eventos |
| `enableNotificationsModule` | false | Activa el módulo de Notificaciones. Agrega "Notificaciones" al menú (sección Sistema). Envío de recordatorios de deuda a acreedores vía WhatsApp Cloud API (Meta) |
| `enableEntradasModule` | false | Activa el módulo de Entradas. Agrega "Entradas" al menú (sección Ventas). Venta de entradas desde POS Android externo con impresora térmica |

Los toggles se persisten en la tabla `Setting` y se aplican en tiempo real sin recargar.

## Acreedores / Fiado Module

Ventas fiadas con control de saldo por acreedor. El POS vende con `paymentMethod: FIADO` asociado a un acreedor activo; los pagos (`POST /acreedores/:id/pagos`) y ajustes (`POST /acreedores/:id/ajustes`) imputan en FIFO contra `FiadoVenta.saldoRestante`. Límites opcionales por acreedor (`limiteDeuda` bloquea, `advertenciaDeuda` avisa) e intereses configurables (`GET /acreedores/intereses/preview`, `POST /acreedores/intereses/aplicar`).

### Configuración
- **Toggle "Fiado"** en AdminSettingsPage → pestaña Ventas → Medios de pago (visible solo si `enableAcreedoresModule === true`).
- Por defecto desactivado (`enableFiadoPayment: false`).
- Sin acreedores activos, el select del POS muestra "No hay acreedores activos".

## Internet Vouchers / Módulo WiFi

Módulo para venta de vouchers de acceso a internet WiFi respaldados por RADIUS. Se integra con la API de `api-radius` (proyecto `~/internet-sale`).

### Estructura
```
backend/src/modules/internet-vouchers/
├── internet-vouchers.module.ts
├── internet-plans.controller.ts       # CRUD de planes (ADMIN)
├── internet-plans.service.ts          # Lógica: plan ↔ producto sync automático
├── internet-vouchers.controller.ts    # Generación/consulta/anulación de vouchers + listado
├── internet-vouchers.service.ts       # Cliente HTTP → api-radius:3001 (usa http module nativo)
└── dto/
    ├── create-plan.dto.ts
    ├── update-plan.dto.ts
    └── generate-voucher.dto.ts
```

### Modelos
- **InternetPlan**: define un plan (nombre, duración, ancho de banda, precio). Al crearse, genera automáticamente un `Product` asociado bajo la categoría "Internet". El producto usa como icono la duración formateada ("1d", "24h", "30d").
- **SaleVoucher**: registra cada voucher generado para una venta (PIN, plan, activo). Se crean al confirmar el pago.

### Flujo
1. Admin activa el módulo en Configuración → Módulos → "Vouchers WiFi"
2. Admin crea planes en Internet → cada plan crea automáticamente un producto en la categoría "Internet" (stock=0, ilimitado, icono=duración)
3. En el POS, la categoría "Internet" aparece con los productos ordenados por duración (1h → 3h → 24h → ...)
4. Al vender un plan, el backend llama a `api-radius:3001/api/vouchers/generate` con parámetros inline vía `http.request` (NO usa `fetch` — bug de undici en Docker DNS)
5. El voucher se genera al confirmar el pago (CASH/FIADO: inmediato, MP_QR: vía webhook, TRANSFER: al confirmar)
6. Los PINs se guardan en `SaleVoucher` y se incluyen en el ticket impreso (sección "Internet WiFi" con PIN en grande)
7. Si se anula la venta, los vouchers se desactivan automáticamente vía `POST /vouchers/deactivate-by-sale`

### Página de Internet (Admin)
Dos tabs con estilo `treasury-subnav-link` (naranja):

| Tab | Contenido |
|-----|-----------|
| **Vouchers** (default) | Tabla de vouchers vendidos: fecha, venta #, plan, estado (badge Activo/Anulado), botón Estado (modal con PIN, activación, vencimiento, tiempo restante y MAC en vivo desde api-radius) y Anular. |
| **Planes** | Tabla de planes configurados: nombre, duración, ancho de banda, precio, activo. FAB "+" para crear. Modal con selects de duración, bandwidth y precio (permite $0). |

### Comportamiento del módulo
- **Activado**: categoría "Internet" visible en POS y admin, productos ordenados por duración, sidebar muestra "Internet"
- **Desactivado**: categoría "Internet" oculta del POS (`active=false`) y filtrada del admin, sidebar oculta "Internet", no se generan vouchers
- La sincronización categoría ↔ módulo se hace en `SettingsService.update()` y `CategoriesService.listAll()`

### Configuración
- `VOUCHER_API_URL`: URL base de api-radius (default: `http://api-radius:3001/api`)
- `Setting.enableInternetModule`: toggle del módulo (default: false)
- El precio 0 está permitido en los planes (para planes gratuitos)

### Relación con internet-sale
- api-radius es un stack Docker separado (`~/internet-sale`) con 4 servicios: postgres-radius, api-radius, freeradius, portal
- Ambos comparten la red `soler_default` para que el backend de m-posw pueda llamar a `api-radius:3001`
- Los planes se definen en m-posw (fuente de verdad); api-radius acepta parámetros inline vía el endpoint `POST /vouchers/generate`
- `plans.json` en internet-sale es legacy/fallback
- **IMPORTANTE**: El código usa `http.request` de Node.js (no `fetch`) porque `undici` (el motor de `fetch` en Node 20) falla al resolver DNS de Docker internamente
- **IMPORTANTE**: La columna `sale_id` en `radius.vouchers` debe ser `VARCHAR(50)` (no `INTEGER`) porque m-posw usa UUIDs

### Endpoints del módulo
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/internet/plans` | Listar planes (ADMIN) |
| `POST` | `/internet/plans` | Crear plan → auto-crea Product |
| `PATCH` | `/internet/plans/:id` | Editar plan → actualiza Product |
| `DELETE` | `/internet/plans/:id` | Eliminar plan → elimina Product |
| `GET` | `/internet/vouchers/list` | Listar vouchers vendidos (sin PIN) |
| `POST` | `/internet/vouchers/generate` | Generar voucher individual |
| `GET` | `/internet/vouchers/:pin` | Consultar voucher |
| `DELETE` | `/internet/vouchers/:pin` | Anular voucher |


## Jugadores / Players Module

Módulo integral para gestión de jugadores de fútbol/torneos deportivos: padrón de jugadores, categorías por edad, torneos con fichaje, dashboard con estadísticas y cumpleaños. Solo ADMIN. Accesible desde `/admin/players`.

### Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL (local)                                               │
│  Player, PlayerCategory, Tournament, TournamentCategory,          │
│  TournamentPlayer                                                 │
└────────┬─────────────────────────────────────────────────────────┘
         │ Prisma
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  m-POSw Backend (NestJS)                                          │
│  players/          — CRUD jugadores + import/export Excel         │
│  player-categories/ — CRUD categorías (edad / año nacimiento)     │
│  tournaments/      — CRUD torneos + fichaje/desfichaje + elegibles│
│  players-stats/    — Dashboard (KPIs, gráfico fichados, cumpleaños)│
└────────┬─────────────────────────────────────────────────────────┘
         │ JSON (REST API)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  m-POSw Frontend (React + React Query)                            │
│  PlayersLayout        — Sub-nav: Dashboard | Jugadores | Categ. | Torn. │
│  PlayersDashboardPage — KPIs, barras por torneo/categoría, cumpleaños  │
│  PlayersPage          — Tabla paginada con CRUD + import/export Excel │
│  PlayerCategoriesPage — CRUD categorías + toggle activo/año corte     │
│  TournamentsPage      — CRUD torneos + modal de gestión de jugadores  │
│  TournamentPlayersModal — Fichar/desfichar jugadores por categoría    │
└──────────────────────────────────────────────────────────────────┘
```

### Estructura

```
backend/src/modules/
├── players/
│   ├── players.module.ts
│   ├── players.controller.ts
│   ├── players.service.ts
│   └── dto/
│       ├── create-player.dto.ts
│       └── update-player.dto.ts
├── player-categories/
│   ├── player-categories.module.ts
│   ├── player-categories.controller.ts
│   ├── player-categories.service.ts
│   └── dto/
│       ├── create-player-category.dto.ts
│       └── update-player-category.dto.ts
├── tournaments/
│   ├── tournaments.module.ts
│   ├── tournaments.controller.ts
│   ├── tournaments.service.ts
│   └── dto/
│       ├── create-tournament.dto.ts
│       ├── update-tournament.dto.ts
│       └── fichar-jugadores.dto.ts
└── players-stats/
    ├── players-stats.module.ts
    ├── players-stats.controller.ts
    └── players-stats.service.ts
```

### Modelo de datos

```
Player ──1:N──> TournamentPlayer ──N:1──> Tournament
PlayerCategory ──1:N──> TournamentCategory ──N:1──> Tournament
```

- **Player**: datos personales (firstName, lastName, dni, birthDate, sex). DNI único validado en service.
- **PlayerCategory**: categoría por edad. Dos tipos: `AGE` (rango: ageMin/ageMax con cutoff month/day) o `BIRTH_YEAR` (año fijo).
- **Tournament**: torneo (name, year, allowedSex: M/F/X, birthYearMin/Max, minPlayers/maxPlayers para visualización).
- **TournamentCategory**: relación N:N entre torneo y categorías habilitadas.
- **TournamentPlayer**: fichaje de un jugador en un torneo con categoría asignada automáticamente (`playerCategoryId`). Constraint única `[playerId, tournamentId]`.

### Endpoints — Jugadores

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/players` | READ | Lista paginada con filtros `?search=`, `?sex=`, `?page=`, `?limit=` |
| `GET` | `/players/export` | READ | Exportar Excel (.xlsx) |
| `GET` | `/players/:id` | READ | Detalle del jugador con torneos |
| `POST` | `/players` | FULL | Crear jugador |
| `POST` | `/players/import-excel` | FULL | Importar desde .xlsx (multipart). Retorna `{ creados, errores[] }` |
| `PUT` | `/players/:id` | FULL | Editar jugador |
| `DELETE` | `/players/:id` | FULL | Eliminar jugador |

### Endpoints — Categorías

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/player-categories` | READ | Lista todas con torneos asociados |
| `GET` | `/player-categories/:id` | READ | Detalle de una categoría |
| `POST` | `/player-categories` | FULL | Crear categoría |
| `PUT` | `/player-categories/:id` | FULL | Editar categoría |
| `DELETE` | `/player-categories/:id` | FULL | Eliminar (bloquea si está en uso) |

### Endpoints — Torneos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/tournaments` | READ | Lista paginada con filtros `?year=`, `?allowedSex=`, `?page=`, `?limit=` |
| `GET` | `/tournaments/:id` | READ | Detalle del torneo |
| `POST` | `/tournaments` | FULL | Crear torneo con `categoryIds?` |
| `PUT` | `/tournaments/:id` | FULL | Editar torneo. Reemplaza categorías si se envía `categoryIds` |
| `DELETE` | `/tournaments/:id` | FULL | Eliminar (bloquea si tiene jugadores fichados) |
| `GET` | `/tournaments/:id/players` | READ | Jugadores fichados. Filtros: `?search=`, `?categoryId=` |
| `POST` | `/tournaments/:id/players/eligible` | READ | Jugadores elegibles para fichar (usa POST por compatibilidad) |
| `POST` | `/tournaments/:id/players` | FULL | Fichar jugadores. Body: `{ playerIds }`. Retorna `{ fichados, errores[] }` |
| `DELETE` | `/tournaments/:id/players/:playerId` | FULL | Desfichar un jugador |

### Endpoints — Dashboard

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/players-stats/dashboard` | READ | KPIs: totalPlayers, playersInTournaments, totalWithoutTournament, playersByCategory, upcomingBirthdays (próximos 20 días) |

### Algoritmo de asignación de categoría al fichar

- Para `BIRTH_YEAR`: compara `birthYear` del jugador con el de la categoría.
- Para `AGE`: calcula `edad = año_torneo - año_nacimiento`. Si el cumpleaños es posterior al cutoff (`ageCutoffMonth`/`ageCutoffDay`), resta 1 año. Verifica `ageMin <= edad <= ageMax`.
- Jugadores ya fichados en otro torneo del mismo año se marcan con `fichadoEnOtroTorneoMismoAnio` y se muestra warning.

### Frontend

```
frontend/src/pages/players/
├── PlayersLayout.tsx            # Sub-nav con 4 tabs
├── index.tsx                    # Dashboard: KPIs, barras por torneo, cumpleaños
├── PlayersPage.tsx              # Tabla paginada + CRUD + import/export Excel
├── PlayerCategoriesPage.tsx     # CRUD categorías con campos dinámicos según tipo
├── TournamentsPage.tsx          # CRUD torneos + modal de gestión de jugadores
└── TournamentPlayersModal.tsx   # Fichar/desfichar jugadores por categoría
```

- React Query hooks en `api/queries.ts`: `usePlayers`, `usePlayer`, `usePlayerCategories`, `usePlayerCategory`, `useTournaments`, `useTournament`, `useTournamentPlayers`, `useEligiblePlayers`, `usePlayersDashboard`.
- Tipos en `api/types.ts`: `Player`, `PaginatedPlayers`, `PlayerCategory`, `Tournament`, `PaginatedTournaments`, `EligiblePlayer`, `FichadoPlayer`, `PlayersDashboard`.
- Sidebar: ícono UsersRound + label "Jugadores" en sección Deportes, condicionado a `enablePlayersModule` y permiso `PLAYERS`.

### Configuración

- `Setting.enablePlayersModule` (default: `false`): toggle en Configuración → Módulos.
- Al activar, aparece "Jugadores" en el sidebar (solo ADMIN).

## Patrimonio / Bienes Module

Módulo de gestión de bienes/activos con historial de eventos inmutable. Accesible desde `/admin/patrimonio`. Permisos: HIDDEN / READ / FULL.

### Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL (local)                                           │
│  AssetCategory, AssetStatus, Asset, AssetEvent                │
└────────┬─────────────────────────────────────────────────────┘
         │ Prisma
         ▼
┌──────────────────────────────────────────────────────────────┐
│  m-POSw Backend (NestJS)                                      │
│  assets/             — CRUD bienes + historial de eventos      │
│  asset-categories/   — CRUD categorías + toggle active         │
│  asset-statuses/     — CRUD estados intermedios + toggle       │
└────────┬─────────────────────────────────────────────────────┘
         │ JSON (REST API)
         ▼
┌──────────────────────────────────────────────────────────────┐
│  m-POSw Frontend (React + React Query)                        │
│  PatrimonioPage       — Layout con tabs: Bienes | Config      │
│  BienesPage           — Tabla con filtros, CRUD, baja, eventos│
│  CategoryManager      — ABM de categorías en tabla            │
│  StatusManager        — ABM de estados intermedios            │
└──────────────────────────────────────────────────────────────┘
```

### Estructura

```
backend/src/modules/patrimonio/
├── patrimonio.module.ts
├── assets/
│   ├── assets.controller.ts
│   ├── assets.service.ts
│   └── dto/
│       ├── create-asset.dto.ts
│       ├── update-asset.dto.ts
│       └── change-status.dto.ts
├── asset-categories/
│   ├── asset-categories.controller.ts
│   ├── asset-categories.service.ts
│   └── dto/
│       ├── create-category.dto.ts
│       └── update-category.dto.ts
└── asset-statuses/
    ├── asset-statuses.controller.ts
    ├── asset-statuses.service.ts
    └── dto/
        ├── create-status.dto.ts
        └── update-status.dto.ts
```

### Modelo de datos

```
AssetCategory ──1:N──> Asset ──1:N──> AssetEvent
AssetStatus   ──1:N──> Asset
AssetStatus   ──1:N──> AssetEvent
```

- **AssetCategory**: nombre de categoría (ej: "Mobiliario", "Electrónica"). `isActive`.
- **AssetStatus**: estado del bien. Dos estados del sistema (`isSystem: true`): "Activo" y "De Baja". Estados intermedios configurables por el usuario.
- **Asset**: bien registrado. Campos: name, description, categoryId, statusId, location, acquisitionDate, acquisitionValue (Decimal 12,2), notes, isActive (soft delete).
- **AssetEvent**: historial inmutable de eventos. Tipos: `ALTA`, `MODIFICACION`, `CAMBIO_ESTADO`, `BAJA`. Registra `userId`, `eventDate`, `description`, `statusId` resultante.

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/assets` | READ | Listado con filtros: `?categoryId=`, `?statusId=`, `?location=`, `?isActive=`, `?page=`, `?limit=` |
| `GET` | `/assets/:id` | READ | Detalle del bien |
| `POST` | `/assets` | FULL | Alta de bien (genera evento `ALTA`. status inicial = "Activo") |
| `PATCH` | `/assets/:id` | FULL | Edición de datos generales (genera evento `MODIFICACION`) |
| `PATCH` | `/assets/:id/status` | FULL | Cambio de estado (genera evento `CAMBIO_ESTADO`). No permite asignar "De Baja" |
| `DELETE` | `/assets/:id` | FULL | Baja lógica: `isActive = false`, `status = DE_BAJA` (genera evento `BAJA`) |
| `GET` | `/assets/:id/events` | READ | Historial del bien |
| `GET` | `/asset-categories` | READ | Listado de categorías con contador de bienes |
| `POST` | `/asset-categories` | FULL | Crear categoría |
| `PATCH` | `/asset-categories/:id` | FULL | Editar nombre |
| `PATCH` | `/asset-categories/:id/toggle` | FULL | Activar/desactivar (bloquea si tiene bienes activos) |
| `GET` | `/asset-statuses` | READ | Listado de estados con contador de bienes |
| `POST` | `/asset-statuses` | FULL | Crear estado intermedio |
| `PATCH` | `/asset-statuses/:id` | FULL | Editar nombre (solo si `isSystem = false`) |
| `PATCH` | `/asset-statuses/:id/toggle` | FULL | Activar/desactivar (solo si `isSystem = false`) |
| `DELETE` | `/asset-statuses/:id` | FULL | Eliminar (solo si `isSystem = false` y sin bienes asociados) |

### Reglas de negocio

- **Baja**: verifica que el bien no esté ya en DE_BAJA. Setea `isActive = false` y `statusId = DE_BAJA`. Un bien dado de baja no puede volver a activarse ni cambiar de estado.
- **Cambio de estado**: no permite asignar DE_BAJA desde este endpoint (solo vía DELETE). Registra estado anterior y nuevo en la descripción del evento.
- **Modificación**: cualquier PATCH sobre datos del bien registra evento `MODIFICACION` con descripción de campos modificados.
- **Estados del sistema**: si `isSystem = true`, los endpoints de edición, toggle y delete devuelven 403 Forbidden.
- **Categorías**: no permite desactivar categorías con bienes activos asociados.
- **Historial inmutable**: no hay endpoints de edición o eliminación de eventos.
- **Bienes nunca se eliminan físicamente** de la base de datos.

### Frontend

```
frontend/src/pages/patrimonio/
├── PatrimonioPage.tsx              # Layout con tabs (treasury-subnav-link): Bienes | Config
├── BienesPage.tsx                  # Tabla con filtros + FAB + modales
├── ConfigPage.tsx                  # CategoryManager + StatusManager
├── components/
│   ├── AssetStatusBadge.tsx        # Badges de color por estado y tipo de evento
│   ├── AssetForm.tsx               # Modal alta/edición (settings-field)
│   ├── AssetDetail.tsx             # Modal detalle + tabla de historial
│   ├── ChangeStatusModal.tsx       # Modal cambio de estado
│   └── BajaConfirmModal.tsx        # Modal confirmación de baja
└── config/
    ├── CategoryManager.tsx         # ABM de categorías (tabla sales-table)
    └── StatusManager.tsx           # ABM de estados intermedios
```

- React Query hooks en `api/queries.ts`: `useAssets`, `useAsset`, `useAssetEvents`, `useAssetCategories`, `useAssetStatuses`, `useCreateAsset`, `useUpdateAsset`, `useChangeAssetStatus`, `useDeleteAsset`, `useCreateAssetCategory`, `useUpdateAssetCategory`, `useToggleAssetCategory`, `useCreateAssetStatus`, `useUpdateAssetStatus`, `useToggleAssetStatus`, `useDeleteAssetStatus`.
- Tipos en `api/types.ts`: `AssetCategory`, `AssetStatus`, `Asset`, `AssetEvent`, `PaginatedAssets`, `AssetEventType`.
- Sidebar: ícono PenTool + label "Patrimonio" en sección Administración, condicionado a `enablePatrimonioModule` y permiso `PATRIMONIO`.

### Configuración

- `Setting.enablePatrimonioModule` (default: `true`): toggle en Configuración → Módulos.
- Seed inserta estados del sistema "Activo" y "De Baja" (`isSystem: true`).

Sistema de theming con CSS variables (`data-theme` attribute en `<html>`):

- **Tema claro**: default.
- **Tema oscuro**: toggle en el header, persiste en `localStorage`.
- **Detección automática**: respeta `prefers-color-scheme` del sistema.
- **CSS Variables**: todos los colores tokenizados (primary, surface, text, border, etc.).

## UI/UX — Sistema de diseño (DESIGN.md)

`DESIGN.md` (en la raíz) es la fuente de verdad de la UI web. Implementación actual:

- **Tokens** (`frontend/src/styles/tokens.css`): `--color-primary` (acento configurable desde Configuración, inyectado por `AppLayout` vía `utils/accent.ts` con `on-primary` por luminancia) + derivados `color-mix` (`hover/active/soft/border/text`), semánticos `*-soft`, tipografía por rol (`text-*`), espaciado (`space-*`), radios, sombras, `--control-h` (40px, 44px en `pointer:coarse`), `--content-max: 1400px`.
- **Componentes** (`frontend/src/components/ui/`): `PageLayout/PageHeader`, `Tabs` (+ `RouteTabs` para layouts, con flechas ←/→), `KpiGrid/KpiCard` (`tone`, `loading`), `Badge`, `Button` (`busy`, tamaño `sm` 36px vía `--control-h-sm` para la topbar)/`Fab`, `Input/Select/DateInput/Textarea/MoneyInput/SearchInput/SegmentedControl/FormField/FormGrid/IconPicker`, `DataTable` (`density`, `priority="low"`, `loading`, `error`+`onRetry`, `emptyState` con acción), `Modal` (`dirty` con confirmación, trampa de foco, Esc, retorno de foco)/`ConfirmDialog`, `Card/Toolbar/ListError/Delta`.
- **Layouts con tabs** (Socios, Tesorería, Jugadores, Patrimonio): `PageHeader` del módulo + `RouteTabs` + `Outlet`; las páginas hijas no repiten header (acciones/info viva van en `ui-toolbar`).
- **Formato** (`frontend/src/utils/format.ts`, `es-AR`): `formatMoney` (`$ 1.200`, `cents: true` → `$ 1.200,00`), `formatPercent` (`500,0%`), `formatDate` (`dd/MM/yyyy`), `formatDateTime` (`dd/MM/yyyy HH:mm`), `formatDateLong`, `formatNumber`. Prohibido formatear fuera de ahí.
- **Accesibilidad**: contraste texto 4,5:1 / iconos 3:1 (verificado), táctil 44px en coarse, foco solo con `:focus-visible`, `aria-label` en botones de ícono de la topbar, `ConfirmDialog` antes de eliminar, `ListError` + Reintentar, `Toast` (success/error/warning/info, `aria-live`).
- **Reglas al tocar UI**: un `primary` por zona, estados con color semántico + texto (nunca solo color), sidebar activo = `primary-soft` + barra 3px (sin outline), logo solo en sidebar (versión corta al colapsar).
- **Probar cambios de UI** con 3 acentos (claro, oscuro, saturado) en modo claro y oscuro. Verificar `npm run build` en `frontend/`.

Pendientes conocidos: migrar tablas legacy (`.sales-table`) a `DataTable` (con `priority="low"` en secundarias) y modales legacy a `ui/Modal` (+ `useDirtyForm`); filtros por URL en Socios/Acreedores/Internet para enlaces profundos del Home; endpoint dedicado de últimos movimientos (hoy deriva de `GET /sales`, ver TODO en `HomePage`).

## Notificaciones / WhatsApp Módulo

Módulo de notificaciones genérico con WhatsApp Cloud API (Meta) como proveedor. Diseñado para ser extensible a otros canales (SMS, email) en el futuro.

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  m-POSw Backend        │  Meta Graph API       │         │
│  NotificacionesService │  (WhatsApp Cloud)     │         │
│  WhatsAppCloudProvider │                       │         │
└────────┬───────────────┴───────────────────────────────┘
         │ Bearer Token + POST /messages
         ├────────────────────▶ WhatsApp Server ──▶ WhatsApp Client
```

### Estructura

```
backend/src/modules/notificaciones/
├── notificaciones.module.ts
├── notificaciones.controller.ts    # Endpoints: config, test, history, queue, conversations, media
├── notificaciones.service.ts       # Lógica: cola, envío, rate limiting, logs, conversaciones, unread count
├── whatsapp-media.service.ts       # Descarga lazy + serve de archivos multimedia (Meta API)
├── webhook.controller.ts           # Webhook público: recepción de mensajes entrantes (text/image/audio/sticker) y status updates
├── providers/
│   ├── provider.interface.ts       # INotificationProvider (genérico)
│   └── whatsapp-cloud.provider.ts  # WhatsApp Cloud API (Graph v21)
└── dto/
    └── send-notification.dto.ts
```

### Modelos

- **NotificationLog**: registra cada intento de envío (SENT/FAILED), destinatario, mensaje, canal, template usado, error, externalMessageId. Relación opcional con `Acreedor` (`acreedorId`).
- **NotificationJob**: jobs encolados con estado (QUEUED/PROCESSING/SENT/FAILED/CANCELLED), intentos, template, parámetros, batchId.
- **Setting**: campos de configuración — `enableNotificationsModule`, `whatsappPhoneNumberId`, `whatsappAccessToken`, `whatsappBusinessAccountId`, `whatsappWebhookVerifyToken`, `whatsappMessageTemplate`.

### Flujo

1. Admin activa el módulo en Configuración → Módulos → "Módulo de Notificaciones (WhatsApp)"
2. Admin configura credenciales de la API oficial de Meta en `/admin/notificaciones`:
   - **Phone Number ID**: ID del número de teléfono en Meta Business Suite
   - **Access Token**: token permanente generado en Meta Developers
   - **Business Account ID**: WABA ID (opcional)
   - **Webhook Verify Token**: token para verificar webhooks entrantes (opcional)
   - **Plantilla de mensaje**: texto con variables `{{nombre}}`, `{{saldo}}`, `{{dias}}`, `{{club}}`
3. En Acreedores, aparece botón de WhatsApp en la lista (por fila) y en el detalle
4. Al clickear "Notificar deuda", el backend:
   - Verifica `enableNotificationsModule === true`
   - Verifica que el acreedor tenga teléfono y saldo > 0
   - Normaliza el número a formato internacional (`549{numero}`)
   - Reemplaza `{{nombre}}`, `{{saldo}}`, `{{dias}}`, `{{club}}` en la plantilla
   - Encola un `NotificationJob` con status QUEUED
   - La cola procesa secuencialmente (1 msg/segundo para respetar rate limits de Meta)
   - Registra en `NotificationLog` al completar
5. El historial completo de envíos se ve en `/admin/notificaciones?tab=history`

### Endpoints del módulo

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/notificaciones/config` | READ | Estado del provider, credenciales configuradas |
| `POST` | `/notificaciones/test` | FULL | Probar conexión con WhatsApp Cloud API |
| `GET` | `/notificaciones/history` | READ | Historial paginado con filtros (`?status=`, `?acreedorId=`) |
| `GET` | `/notificaciones/queue` | READ | Cola actual con contadores (`?status=`, `?page=`, `?limit=`) |
| `POST` | `/notificaciones/queue/retry` | FULL | Reintentar jobs fallidos (`{ jobIds: number[] }`) |
| `POST` | `/notificaciones/queue/pause` | FULL | Pausar procesamiento de la cola |
| `POST` | `/notificaciones/queue/resume` | FULL | Reanudar procesamiento de la cola |
| `POST` | `/notificaciones/queue/cancel-all` | FULL | Cancelar todos los jobs QUEUED |
| `GET` | `/notificaciones/phone-info` | READ | Info del número de WhatsApp Business (display name, quality) |
| `GET` | `/notificaciones/templates` | READ | Listar templates aprobados de la WABA |

### Endpoints de Conversaciones / Chat

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/notificaciones/conversations` | READ | Lista de conversaciones paginada (`?page=`, `?limit=`) con último mensaje, ventana 24hs y `unreadCount` |
| `GET` | `/notificaciones/conversations/unread-count` | Público (JWT) | Total de mensajes INBOUND no leídos. Usado por el botón de notificaciones en el header. Polling cada 10s |
| `POST` | `/notificaciones/conversations/read-all` | READ | Marcar todas las conversaciones como leídas (`lastReadAt = now()`) |
| `GET` | `/notificaciones/conversations/:id/messages` | READ | Mensajes de una conversación (`?page=`, `?limit=`), ordenados cronológicamente |
| `POST` | `/notificaciones/conversations/:id/send` | FULL | Enviar mensaje de texto en una conversación existente. Body: `{ text }` |
| `POST` | `/notificaciones/conversations/send` | FULL | Enviar mensaje a un número (crea conversación si no existe). Body: `{ phone, text }` |
| `DELETE` | `/notificaciones/conversations/:id/messages/:msgId` | FULL | Eliminar un mensaje individual. Elimina archivo multimedia asociado. Si es el último, borra también la conversación |
| `DELETE` | `/notificaciones/conversations/:id` | FULL | Eliminar una conversación completa con sus mensajes y archivos multimedia (cascade) |
| `GET` | `/notificaciones/media/:messageId` | READ | Servir archivo multimedia (imagen/audio/sticker). Descarga lazy desde Meta si no existe en disco |

### Webhook de WhatsApp (mensajes entrantes)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/webhooks/whatsapp` | Pública | Verificación de webhook (Meta envía `hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST` | `/webhooks/whatsapp` | Pública | Recepción de mensajes entrantes y actualizaciones de estado (sent/delivered/read) |

El webhook procesa los siguientes tipos de mensajes:
- **`text`**: almacena `content = msg.text.body`.
- **`image`**: guarda `mediaType='image'`, `mediaId`, `mediaMimeType`, `caption` opcional.
- **`audio`**: guarda `mediaType='audio'`, `mediaId`, `mediaMimeType`.
- **`sticker`**: guarda `mediaType='sticker'`, `mediaId`, `mediaMimeType`.
- Otros tipos (`video`, `document`, `location`, etc.) se ignoran.

Crea o actualiza la `WhatsAppConversation` correspondiente, hace matching automático con acreedores por número de teléfono. Las actualizaciones de estado (`statuses`) actualizan el campo `status` en `WhatsAppMessage` y `NotificationJob`.

### Endpoints en Acreedores

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/acreedores/:id/notificar-deuda` | FULL | Enviar WhatsApp con deuda actual del acreedor |
| `POST` | `/acreedores/notificar-deuda-batch` | FULL | Envío masivo a múltiples acreedores |
| `GET` | `/acreedores/batch/:batchId/status` | READ | Estado de un lote de notificaciones |
| `GET` | `/acreedores/:id/notificaciones` | READ | Historial de notificaciones del acreedor |
| `GET` | `/acreedores/notification-status?ids=` | READ | Estado de notificaciones para múltiples acreedores |

### Modelos de Conversaciones (Prisma)

- **WhatsAppConversation**: agrupa mensajes por número de teléfono. Campos: `phoneNumber` (unique), `acreedorId` (nullable, auto-match), `lastMessageAt`, `lastIncomingAt` (para ventana 24hs), `lastReadAt` (para contador de no leídos).
- **WhatsAppMessage**: mensaje individual dentro de una conversación. Campos: `direction` (INBOUND/OUTBOUND), `content`, `externalMessageId` (wa_id de Meta), `status` (sent/delivered/read/sending), `mediaType` (image/audio/sticker), `mediaId`, `mediaMimeType`, `caption`.

### Frontend

```
frontend/src/pages/
├── AdminNotificacionesPage.tsx   # 3 tabs: Configuración, Historial, Conversaciones (chat con burbujas estilo WhatsApp)
├── notificaciones/
│   ├── MediaBubble.tsx           # Renderizado condicional de imágenes, stickers y audio
│   └── LightboxModal.tsx         # Modal de zoom + descarga para imágenes/stickers
└── AdminAcreedoresPage.tsx       # Botón WhatsApp en fila (solo si módulo activo, tiene teléfono, saldo > 0)
```

```
frontend/src/components/
├── AppHeader.tsx                # Header con botón de notificaciones (MessageCircle + badge rojo)
├── WhatsAppBubble.tsx            # Burbuja flotante (legacy, reemplazada por botón en AppHeader)
└── ...
```

**Tab Conversaciones** en `AdminNotificacionesPage.tsx`:
- Panel izquierdo: lista de conversaciones con badge azul de no leídos, puntito verde si ventana 24hs abierta, botón 🗑 para eliminar conversación completa.
- Panel derecho: chat con burbujas (OUTBOUND azul a la derecha, INBOUND gris a la izquierda), checkmarks de estado (✓/✓✓), timestamp.
- Renderizado multimedia: imágenes con lightbox + zoom + descarga, stickers sin fondo, audio con player nativo HTML5.
- Cada burbuja tiene botón 🗑 en la esquina (opacidad 0.4, 1.0 en hover) para eliminar mensaje individual (también elimina archivo multimedia asociado).
- Input de respuesta habilitado solo si la ventana 24hs está abierta.
- Optimistic update: el mensaje enviado aparece instantáneamente con `status: 'sending'` y `...`, se reemplaza al confirmar el servidor.
- Al acceder vía `?tab=conversaciones`, marca automáticamente todas como leídas.

**Hooks de React Query** en `api/queries.ts`:
- `useConversations`, `useConversationMessages`, `useSendConversationMessage` (optimistic update), `useDeleteConversationMessage`, `useDeleteConversation`, `useUnreadCount` (polling 10s), `useMarkAllConversationsRead`

### Botón de notificaciones en header

Integrado en `AppHeader.tsx` como un botón `header-toggle-button` junto al toggle de tema:
- Ícono `MessageCircle` (lucide-react), mismo tamaño que los demás botones (18px).
- Badge rojo arriba-derecha con contador de no leídos (99+ si excede 99).
- Visible solo si `enableNotificationsModule === true` y el usuario tiene acceso al módulo NOTIFICACIONES.
- Click → navega a `/admin/notificaciones?tab=conversaciones`.
- Polling cada 10s vía `useUnreadCount()` → `GET /notificaciones/conversations/unread-count`.

### Configuración desde la GUI

**Pestaña "Configuración" en `/admin/notificaciones`:**
- **Phone Number ID**: ID del número de teléfono en Meta Business Suite (se obtiene en WhatsApp → Configuración)
- **Access Token**: token permanente generado en Meta Developers (Herramientas → Generar token → whatsapp_business_messaging)
- **Business Account ID**: WABA ID para listar templates (opcional)
- **Webhook Verify Token**: token para validar webhooks entrantes (opcional, solo si se configuran notificaciones de mensajes recibidos)
- **Plantilla de mensaje**: textarea con vista previa en vivo y variables `{{nombre}}`, `{{saldo}}`, `{{dias}}`, `{{club}}`
- **Probar conexión**: botón que envía una solicitud de estado a la API de Meta

### Configuración relacionada

- `Setting.enableNotificationsModule` (default: `false`): toggle en Configuración → Módulos.
- `Setting.whatsappPhoneNumberId`: ID del número de teléfono de WhatsApp Business.
- `Setting.whatsappAccessToken`: token de acceso permanente de Meta.
- `Setting.whatsappBusinessAccountId`: WABA ID de la cuenta de negocio.
- `Setting.whatsappWebhookVerifyToken`: token para verificación de webhooks.
- `Setting.whatsappMessageTemplate`: plantilla de mensaje con `{{nombre}}`, `{{saldo}}`, `{{dias}}`, `{{club}}`.

### Rate limiting

- **1 mensaje por segundo** entre envíos (global). WhatsApp Cloud API permite hasta 20 msg/s, por simplicidad se usa 1 msg/s.
- Verificado internamente con un delay de 1000ms entre jobs procesados.

### Provider interface (extensible)

```typescript
interface INotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendMessage(phone: string, templateName: string, params: Record<string, string>): Promise<SendResult>;
  sendTextMessage(phone: string, text: string): Promise<SendResult>;
  getStatus(): Promise<ProviderStatus>;
}
```

Para agregar un nuevo canal (SMS, email, etc.), implementar `INotificationProvider` y registrarlo en el módulo.

### Plantilla por defecto

```
Hola {{nombre}}, tenés un saldo pendiente de ${{saldo}} en {{club}} ({{dias}} días).
```

## Entradas / POS Externo Module

Módulo de venta de entradas desde terminal POS Android con impresora térmica (Sunmi V2s, 58mm). El POS opera **fuera del VPS** por HTTPS (`https://${CADDY_HOST}/api/entradas/...` vía Caddy → nginx `/api/` → backend). Referencia de API: esta sección (el contrato `docs/contrato-pos-entradas.txt` se eliminó por obsoleto).

### Estructura
```
backend/src/modules/entradas/
├── entradas.module.ts            # imports: Users, Sales (MP), Socios (QR/descuentos), Acreedores (fiado POS)
├── entradas-admin.controller.ts  # CRUD web (JWT + RequireModule ENTRADAS)
├── entradas-device.controller.ts # API del terminal (EntradasDeviceGuard, Bearer ent_...)
├── device-lookup.controller.ts   # Lookups agnósticos (socio/beneficios, ambos modos)
├── device-me.controller.ts       # GET devices/me (modo del token)
├── dispositivos.controller.ts    # ABM terminales + MP por device (CONFIGURACION)
├── pos-device.controller.ts      # API modo POS bufet (@DeviceKind pos)
├── entradas-shared.controller.ts # GET ticket-template + escudo (FlexibleGuard: JWT o device)
├── entradas-admin.service.ts     # ABMs, devices, template, escudo, defaultWindowFor()
├── entradas-sales.service.ts     # vigentes, intent, status, cancel, approveSale, webhook apply
├── pos-device.service.ts         # Usuario genérico pos-terminal
├── device.guard.ts               # DeviceGuard genérico + @DeviceKind (tokenHash SHA256, lastSeenAt)
├── device-mp.helper.ts           # resolveDeviceMpOrThrow (400 MP_POS_NOT_LINKED)
├── entradas-flexible.guard.ts    # Acepta JWT (READ+) o token device
├── device-token.util.ts          # generate/hash/ent_ + Bearer parsing
├── ticket-template.const.ts      # Layout default 32 cols
└── dto/
```

### Modelos
```
EntradaTorneo ──1:N──> EntradaFixture <──N:1── EntradaRival
EntradaFixture ──1:N──> TicketSale ──1:N──> TicketUnit
EntradaFixture ──1:N──> EntradaContador (uno por sector)
PosDevice ──1:N──> TicketSale
PosDevice ──1:N──> Sale (deviceId, ventas bufet; null = web)
Sale ──1:N──> FiadoVenta (POS: vía pos-terminal + acreedorId)
```

- **EntradaTorneo**: solo `nombre` + `precio` (precio único, sin L/V).
- **EntradaRival**: solo `nombre`.
- **EntradaFixture**: `fecha` + `torneoId` + `rivalId` + `ventanaDesde/Hasta` (default 06:00 → 05:59+1, editable). `@@unique(fecha, torneoId, rivalId)`.
- **PosDevice**: `tokenHash` SHA256 (el token `ent_...` se muestra una sola vez + pairing `{baseUrl, token}` para QR). Revocable/rotatable. `tipo` ENTRADAS|POS + **MP propio** (`mpStoreId/mpPosId/mpQrData/...`, obligatorio para QR, sin fallback). Se gestiona en Sistema → Dispositivos (`/admin/dispositivos`, CONFIGURACION ─ FAB "+", modal con QR apilado + vinculación MP), no en Entradas.
- **Usuario pos-terminal** (seed, password aleatorio, POS FULL): atribuye ventas de terminales (`Sale.userId`). Sin login posible.
- **Sale.deviceId** nullable → terminal de origen (null = web con POS principal). El PUT/DELETE de órdenes MP usa el POS del device (`posOverride`); CASH no exige MP (`400 MP_POS_NOT_LINKED` solo en QR sin vincular).
- **TicketSale**: `sector` informativo (mismo precio), `cantidad` 1-10, `CASH` aprueba directo, `MP_QR` crea orden Instore con `externalReference=ticket-<id>` en el **POS propio del device** (QR **estático** del device, monto en 1 línea `quantity=1`). `requestId` único = idempotencia.
- **TicketUnit / EntradaContador**: numeración por partido y sector (`L-001`, `V-001`, series independientes, contador atómico + `updateMany` condicional anti-doble-aprobación).
- **EntradaBeneficio** (bufet): descuento % estilo socios para canjear en bufet con el QR de la entrada. Global + sector (`LOCAL|VISITANTE|AMBAS`, se asigna automático al aprobar: mayor %). Destino: categoría, producto o plan de internet. `usoUnico` (default true) vs multiuso.
- **TicketUnit.beneficio**: cada unidad con beneficio lleva `beneficioId` + `benefitCode` corto único (10 chars, QR `ENT:<code>` ~14 chars) + snapshot `beneficioPorcentaje`. Sin beneficio → QR no se imprime.
- **EntradaBeneficioConsumo** (`@@unique(ticketUnitId)` = anti-doble a nivel DB para uso único) + **EntradaBeneficioValidacion** (log de cada validación, cualquier canal).
- **EntradaTicketTemplate** (singleton `default`, versionado) + **EntradaTicketAsset** (singleton `escudo`, PNG 1-bit ≤120KB base64). El POS los cachea por versión.

### Endpoints
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/entradas/torneos` | READ | ABM torneos |
| `POST` / `PATCH` | `/entradas/torneos[/:id]` | FULL | Crear/editar (nombre+precio) |
| `GET` | `/entradas/rivales` | READ | ABM rivales |
| `POST` / `PATCH` | `/entradas/rivales[/:id]` | FULL | Crear/editar (nombre) |
| `GET` | `/entradas/fixtures?from=&to=` | READ | Calendario |
| `POST` / `PATCH` | `/entradas/fixtures[/:id]` | READ | Crear (ventana default) / editar ventana. Calendario operable con READ |
| `DELETE` | `/entradas/fixtures/:id` | READ | Eliminar solo si no tiene ventas (409 `FIXTURE_CON_VENTAS`) |
| `GET` | `/dispositivos` | CONFIG R | Terminales con MP (página Sistema → Dispositivos) |
| `POST` | `/dispositivos` | CONFIG F | Generar token (respuesta única + pairing) |
| `PATCH` | `/dispositivos/:id/tipo` | CONFIG F | Cambiar modo (409 si PENDING, `force` lo saltea) |
| `POST` | `/dispositivos/:id/revoke` | CONFIG F | Revocar |
| `POST` | `/dispositivos/:id/rotate` | CONFIG F | Rotar token |
| `GET` | `/dispositivos/mp-stores` | CONFIG R | Tiendas/POS MP + uso (Principal / Terminal X) |
| `POST` | `/dispositivos/:id/mp-select` | CONFIG F | Vincular POS existente al device |
| `POST` | `/dispositivos/:id/mp-setup` | CONFIG F | Crear tienda+caja en MP para el device |
| `POST` | `/dispositivos/:id/mp-disconnect` | CONFIG F | Desvincular (QR deja de operar) |
| `GET` | `/entradas/mp-pos` | READ | Legacy dedicado (sin lectores; ver Dispositivos) |
| `GET` | `/pos-device/catalog` | device POS | Categorías + productos activos |
| `GET` | `/pos-device/mp-qr` | device POS | QR del POS propio (`null` sin vincular) |
| `POST` | `/pos-device/sales/cash` | device POS | Venta contado (guarda `Sale.deviceId`) |
| `POST` | `/pos-device/sales/qr` | device POS | Intent QR (400 `MP_POS_NOT_LINKED` sin MP) |
| `POST` | `/pos-device/sales/fiado` | device POS | Fiado con `acreedorId` (límite validado en servidor) |
| `GET` | `/pos-device/acreedores` | device POS | Acreedores con saldo/límite/advertencia |
| `GET` | `/pos-device/sales/:id` | device POS | Venta completa con vouchers |
| `GET` | `/pos-device/sales/:id/status` | device POS | Polling QR (2s/120s) |
| `POST` | `/pos-device/sales/:id/cancel` | device POS | Cancelar PENDING (DELETE en su POS) |
| `POST` | `/pos-device/sales/:id/ticket-printed` | device POS | Marca impreso (anti-duplicado) |
| `POST` | `/pos-device/socios/canjes` | device POS | Canjes post-venta (no bloquea) |
| `GET` | `/pos-device/settings` | device POS | Tienda/club + flags `enableCash/Qr/FiadoPayment` (sin transfer) |
| `GET` | `/entradas/mp-pos/detect-stores` | READ | Legacy (ver `/dispositivos/mp-stores`) |
| `POST` | `/entradas/mp-pos/select` | FULL | Legacy (ver `/dispositivos/:id/mp-select`) |
| `POST` | `/entradas/mp-pos/setup` | FULL | Legacy (ver `/dispositivos/:id/mp-setup`) |
| `POST` | `/entradas/mp-pos/disconnect` | FULL | Legacy (ver `/dispositivos/:id/mp-disconnect`) |
| `GET` | `/entradas/sales?fixtureId=` | READ | Ventas con unidades |
| `GET` | `/entradas/sales/summary?fixtureId=` | READ | Conteos L/V + recaudado |
| `GET` | `/entradas/beneficios` | READ | ABM beneficios de bufet |
| `POST` / `PATCH` / `DELETE` | `/entradas/beneficios[/:id]` | FULL | Crear/editar/eliminar (con historial → soft) |
| `GET` | `/entradas/beneficios/validar/:code` | READ | Validar QR bufet (no consume, loguea) |
| `POST` | `/entradas/beneficios/validar/:code/consumir` | READ | Consumir uso único (409 `YA_CONSUMIDO`) |
| `GET` | `/entradas/ticket-template` | JWT o device | Layout JSON (cache por `version`) |
| `GET` | `/entradas/ticket-assets/escudo` | JWT o device | PNG base64 (cache por `version`) |
| `GET` | `/entradas/ticket-assets/escudo-info` | READ | Versión sin imagen (admin) |
| `PATCH` | `/entradas/ticket-template` | FULL | Guardar diseño (1-40 bloques) |
| `POST` | `/entradas/ticket-assets/escudo` | FULL | Subir PNG → 1-bit (multipart) |
| `GET` | `/entradas/fixtures/vigentes` (alias `/hoy`) | device | Fixtures en ventana actual |
| `POST` | `/entradas/sales/intent` | device | Crear venta (`X-Request-Id` idempotente). CASH→APPROVED, MP_QR→PENDING+`qrImageUrl` |
| `GET` | `/entradas/sales/:id/status` | device | Polling + payload impresión (`datos`, `codigos`, `beneficios[]`, versiones) |
| `POST` | `/entradas/sales/:id/cancel` | device | Cancelar PENDING (+ `deleteOrder` MP) |
| `GET` | `/entradas/beneficios/:code` | device | Validar QR bufet |
| `POST` | `/entradas/beneficios/:code/consumir` | device | Consumir uso único (409 `YA_CONSUMIDO`) |
| `GET` | `/entradas/socios/:uuid` | device | Socio + beneficios (descuentos POS y entradas) |

### Webhook MP
`MercadoPagoWebhookProcessorService` deriva `externalReference` con prefijo `ticket-` a `EntradasSalesService` (vía `ModuleRef` lazy, sin ciclo de módulos): aprueba y genera `L-/V-`, registra `SocioCanje` si hubo descuento. `normalizeSaleId` no se tocó (solo `sale-`).

### Permisos
- `ModuleKey.ENTRADAS`: ADMIN = FULL implícito; USER default HIDDEN (solo aparece en `AdminUsersPage` para otorgar). Con READ: solo tabs Ventas y Calendario (control total ahí, fixtures operables); ABM/Diseño/Configuración ocultas (FULL).
- `Setting.enableEntradasModule` (default `false`): toggle en Configuración → Módulos + sidebar condicionado + `assertModuleEnabled()` en device service.

### Frontend
`frontend/src/pages/AdminEntradasPage.tsx` — tabs `Ventas | Calendario | ABM | Beneficios | Diseño | Configuración` (subnav `treasury-subnav-link`). Tab Beneficios (FULL: CRUD + toggle) y validador de QR en Ventas (READ: validar/consumir). Tab Diseño con editor de bloques + preview en vivo (datos ejemplo, 32 cols, escudo real) y upload de escudo 1-bit. Tab Configuración: link a Sistema → Dispositivos (ahí viven terminales + MP). Hooks en `api/queries.ts` (`useEntradaTorneos`, `useEntradaRivales`, `useEntradaFixtures`, `usePosDevices`, `useTicketSales`, `useEntradasSalesSummary`, `useEntradaTicketTemplate`, `useEntradaEscudoInfo`, `useEntradasMpPos`, `useEntradaBeneficios`). Ruta `/admin/entradas` con `ModuleRoute ENTRADAS`; sidebar Ventas con ícono Ticket.
`frontend/src/pages/AdminDispositivosPage.tsx` — FAB "+" abre modal de alta (nombre+tipo → token + QR apilado + vinculación MP en el mismo modal) + tabla con MP por terminal y modal de vincular (Detectar con badges Libre/Principal/Terminal X, Crear, Desvincular). Ruta `/admin/dispositivos` con `ModuleRoute CONFIGURACION`; sidebar Sistema.

### APK Terminal (`m_posw_entradas/`, dual ENTRADAS/POS, README propio)
Un módulo, paquetes `ui/entradas/` y `ui/pos/` sin imports cruzados (CI lo verifica con grep). Común: `data/` (ApiClient/SessionManager/ModeResolver), `printer/`, Scanner, Config, `PagoExitosoDialogFragment`.
- **Modo**: `GET devices/me` en arranque, `onResume`, ticker 60s (solo visible) y ante 403 → cambia de pantalla solo. Sin modo validado queda en Config. Offline usa último conocido. `SessionManager.deviceMode`.
- **Room**: `entradas.db` (`approved_sales`) solo en ENTRADAS; `pos.db` (cache catálogo + aprobadas) solo en POS. Sin `Application` custom (RAM 1GB).
- **POS UI**: dash `TabLayout+ViewPager2` con fotos (Coil, `imagePath` de catalog, fallback color/emoji), total+count, botón `$` (acento) + gear a Config; carrito en franja slide-up; pay-sheet con métodos por Setting (CASH exacto/QR/Fiado, sin transferencia); escaneo único (UUID→socio, `ENT:`→beneficio con tope, consume al aprobar); Fiado con estados OK/⛔/⚠️ (límite bloquea, advertencia doble-tap); ticket Sunmi = contenido `TicketPayload` web; S/M/L (texto+foto+columnas, `scaleDirty`).
- **UI v2 (2026-10)**: tema M3 completo claro/oscuro (`themes/colors/dimens/styles.xml`), `AccentTheme` (semilla = `accentColor` del tenant, on-primary por luminancia; DynamicColors descartado por minSdk 25), `MoneyFormat` único es-AR (`util/`), grilla POS con span por ancho (`anchoDp/150`, 2-4) + `ListAdapter/DiffUtil` e insignia de cantidad, botón Cobrar con total, contadores "Local N · Visitante 0", estado de impresión persistente en el diálogo con reintento (`PrintHelper`), diálogos con radio 24 (`DialogStyle`). Sin blur/elevation en listas, animaciones ≤200ms. El build local requiere SDK (no instalado en dev); compila CI (`build-apk.yml`).
- **Config**: sello `vX.Y.Z (sha)` (`BuildConfig.GIT_SHA`, versionCode 2+) para confirmar build en equipo.
- **CI**: `.github/workflows/build-apk.yml` (tag único `terminal-latest`, package-separation check, `assembleRelease` + debug universal). `docker-publish.yml` ignora `m_posw_entradas/**`.

### Límites conocidos (v1)
- Una sola orden QR activa por POS de MP: con MP propio por terminal, cada una usa el suyo y no se pisan. Sin vincular, el QR no opera (`MP_POS_NOT_LINKED`); CASH sí.
- Transferencia discontinuada en terminales (solo web).
- `SocioCanje.usuarioId` ahora nullable (`posId` = deviceId) para canjes POS.

## Important Constraints

- **Migraciones**: Se aplican automáticamente al iniciar el contenedor backend. No ejecutar manualmente en producción a menos que sepas lo que hacés.
- **Seed**: Corre automáticamente si `RUN_SEED=1` (no está en docker-compose por defecto).
- **CORS**: `CORS_ORIGIN` debe incluir el protocolo (ej: `https://tudominio.com`).
- **Uploads**: Se guardan en volumen `uploads_data`, servidos por backend en `/uploads`.
- **Prisma Client**: Se regenera en build de Docker (no hace falta correr `prisma generate` localmente para deploy).
- **OAuth**: Requiere `INSTANCE_SUBDOMAIN`, `MP_CLIENT_ID`, `MP_CLIENT_SECRET` y `MP_OAUTH_REDIRECT_URI`. El webhook URL se construye como `https://${INSTANCE_SUBDOMAIN}.mposw.com.ar/api/webhooks/mercadopago`.
- **Sidebar**: Colapsable con toggle. Estado persistido en `localStorage`. Breakpoint responsive en 1200px.

## Testing

Backend usa Jest con ts-jest. Tests en archivos `*.spec.ts`.

```bash
cd backend
npm test
```

No hay test suite configurada para frontend ni Android.

## Useful Scripts

| Script | Descripción |
|--------|-------------|
| `deploy.sh` | Deploy completo: pull, build, up |
| `limpiar-datos-operativos.sh --yes` | Reset de datos operativos |
| `backend/scripts/check-prisma-fk-types.js` | Validación de tipos FK en Prisma |

## File Structure

```
m-posw/
├── backend/           # NestJS + Prisma
│   ├── src/
│   │   └── modules/
│   │       ├── accounting/        # Movimientos contables (legacy, redirige a treasury)
│   │       ├── acreedores/        # Acreedores y ventas fiadas (FIFO)
│   │       ├── auth/              # Autenticación JWT
│   │       ├── cash-close/        # Cierres de caja
│   │       ├── cash-movements/    # Movimientos de caja
│   │       ├── categories/        # Categorías de productos
│   │       ├── common/            # Prisma, MP config, guards, uploads
│   │       ├── entradas/          # Entradas POS externo (device guard, fixtures, L/V, template)
│   │       ├── icons/             # Listado de iconos
│   │       ├── internet-vouchers/  # Vouchers WiFi (integración api-radius)
│   │       ├── mercadopago-oauth/ # OAuth 2.0 Mercado Pago
│   │       ├── patrimonio/       # Patrimonio / Bienes (activos + historial)
│   │       ├── payments/          # Transferencias (polling MP)
│   │       ├── player-categories/ # Categorías de jugadores (edad / año nacimiento)
│   │       ├── players/           # Gestión de jugadores + import/export Excel
│   │       ├── players-stats/     # Dashboard de jugadores (KPIs, cumpleaños)
│   │       ├── products/          # Productos + recetas
│   │       ├── reports/           # Reportes generales
│   │       ├── sales/             # Ventas + MP Instore + Webhooks + WebSockets
│   │       ├── settings/          # Configuración del sistema
│   │       ├── socios/            # Padrón de socios + Cuotas + Beneficios + Carnets
│   │       ├── stats/             # Estadísticas y dashboard
│   │       ├── stock/             # Control de stock
│   │       ├── tournaments/       # Torneos deportivos (fichaje, elegibles, categorías)
│   │       ├── treasury/          # Tesorería / Libro Diario (partida doble)
│   │       ├── users/             # Gestión de usuarios
│   │       └── notificaciones/     # Notificaciones WhatsApp vía Cloud API (Meta)
│   ├── prisma/        # Schema + migraciones + seed
│   ├── scripts/       # Utilidades
│   └── Dockerfile
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── api/       # Cliente Axios + React Query hooks + types
│   │   ├── components/# AppHeader, CartPanel, Toast, etc.
│   │   ├── context/   # Auth, Cart, Theme
│   │   ├── hooks/     # useEmbeddedKeyboard
│   │   ├── pages/     # Todas las páginas (Admin*, Treasury*, POS, etc.)
│   │   ├── styles/    # CSS global con variables de tema
│   │   └── utils/     # errorToMessage, ticketPrinting
│   ├── public/
│   │   └── about.md   # Contenido del modal "Acerca de..."
│   ├── nginx.conf     # Config nginx para proxy
│   └── Dockerfile
├── m_posw_android/    # Flutter APK
│   ├── lib/
│   └── android/
├── docker-compose.yml
├── .env.example
└── deploy.sh
```

## Common Issues

1. **Error de red Docker**: Asegurate que `shared_proxy` exista: `docker network create shared_proxy`
2. **CORS errors**: Verificá que `CORS_ORIGIN` coincida exacto con la URL del frontend (incluyendo puerto si aplica).
3. **Webhooks MP no llegan**: Verificá que el endpoint sea público y que `MP_WEBHOOK_SECRET` esté configurado si `MP_WEBHOOK_STRICT_PAYMENT=true`.
4. **QR no genera**: Revisá que `externalStoreId` y `externalPosId` estén configurados para el usuario/caja en la BD (o usá OAuth que lo configura automáticamente).
5. **OAuth no funciona**: Verificá `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` y `INSTANCE_SUBDOMAIN`. El redirect URI debe coincidir exactamente con lo configurado en la app de MP.
6. **Sidebar no colapsa**: Limpiá `localStorage` si el estado persistido está corrupto.
7. **WhatsApp no envía**: Verificá que el Access Token y Phone Number ID estén configurados correctamente en `/admin/notificaciones`. Revisá los logs del backend (`docker compose logs backend`).

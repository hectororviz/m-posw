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
| Ligas | `LIGAS` | HIDDEN, READ, FULL |
| Jugadores | `PLAYERS` | HIDDEN, READ, FULL |
| Patrimonio | `PATRIMONIO` | HIDDEN, READ, FULL |
| Stock | `STOCK` | HIDDEN, READ, FULL |
| Reportes | `REPORTES` | HIDDEN, READ, FULL |
| Configuración | `CONFIGURACION` | HIDDEN, READ, FULL |

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
- **Diseño**: franja de acento vertical, logo 42pt, nombre del club en 14pt, datos del socio, QR en esquina inferior derecha.
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
| `enableLigasModule` | false | Activa el módulo de Ligas Deportivas. Agrega "Ligas" al menú (solo ADMIN). Consulta Supabase para tablas de posiciones y próximos partidos |
| `enablePlayersModule` | false | Activa el módulo de Jugadores. Agrega "Jugadores" al menú (sección Deportes). Gestión de jugadores, categorías por edad, torneos con fichaje |
| `enablePatrimonioModule` | true | Activa el módulo de Patrimonio. Agrega "Patrimonio" al menú (sección Administración). Registro y gestión de bienes/activos con historial de eventos |

Los toggles se persisten en la tabla `Setting` y se aplican en tiempo real sin recargar.

## Acreedores / Fiado Module
...
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
| **Vouchers** (default) | Tabla de vouchers vendidos: fecha, venta #, plan, estado (badge Activo/Usado). Sin mostrar el PIN. |
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

## Ligas Deportivas / Sports Leagues Module

Módulo para seguir tablas de posiciones y próximos partidos de ligas de fútbol. Datos obtenidos de una base Supabase externa (poblada por scraping independiente). Solo ADMIN.

### Arquitectura

```
┌──────────────────────────┐
│  Supabase (externo)       │  ← leagues, categories, teams, matches
│  REST API v1              │  ← Scraping separado (no en este repo)
└────────┬─────────────────┘
         │ fetch() + apikey + Bearer
         ▼
┌──────────────────────────┐
│  m-POSw Backend           │
│  LigasService             │  ← Proxy REST, cómputo de posiciones
│  LigasController          │  ← /api/ligas/* (solo ADMIN)
└────────┬─────────────────┘
         │ JSON
         ▼
┌──────────────────────────┐
│  m-POSw Frontend          │
│  LigasLayout              │  ← Sub-nav con tabs por liga + Config
│  LigasStandingsPage       │  ← Tabla de posiciones + partidos
│  LigasConfigPage          │  ← Asociar torneo+equipo
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  PostgreSQL (local)        │
│  LigasConfig               │  ← Qué ligas/equipos seguir
│  Setting.enableLigasModule │  ← Toggle del módulo
└──────────────────────────┘
```

### Estructura

```
backend/src/modules/ligas/
├── ligas.module.ts
├── ligas.controller.ts        # Endpoints REST (ADMIN)
├── ligas.service.ts           # Proxy Supabase + cómputo posiciones
└── dto/
    └── create-liga-config.dto.ts
```

### Modelo de datos local

- **LigasConfig**: asocia una liga y un equipo de Supabase para seguimiento. Campos: `leagueId`, `leagueName`, `teamId`, `teamName`, `active`.
- **Setting.enableLigasModule** (default: `false`): toggle del módulo.

### Datos remotos (Supabase)

Tablas externas consultadas vía REST:

| Tabla | Campos relevantes |
|-------|-------------------|
| `leagues` | `id`, `name`, `active` |
| `categories` | `id`, `name`, `league_id` |
| `teams` | `id`, `name`, `short_name`, `logo_url`, `city` |
| `matches` | `id`, `league_id`, `category_id`, `local_team_id`, `away_team_id`, `matchday`, `match_date`, `status`, `local_goals`, `away_goals` |

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/ligas/leagues` | Lista ligas activas de Supabase |
| `GET` | `/ligas/leagues/:id/categories` | Categorías dentro de una liga |
| `GET` | `/ligas/leagues/:id/teams` | Equipos con partidos en la liga |
| `GET` | `/ligas/standings?leagueId=&categoryId=` | Tabla de posiciones (solo `finalizado`) |
| `GET` | `/ligas/teams/:id/next-matches?leagueId=` | Próximos partidos (`pendiente`) + pasados no actualizados |
| `GET` | `/ligas/configs` | Lista ligas configuradas localmente |
| `POST` | `/ligas/configs` | Asociar liga + equipo. Body: `{ leagueId, leagueName, teamId, teamName }` |
| `DELETE` | `/ligas/configs/:id` | Eliminar asociación |

### Cómputo de posiciones

- Solo partidos con `status === 'finalizado'`.
- Orden: puntos desc → diferencia de gol desc → goles a favor desc.
- Filtro opcional `categoryId` para tabla por categoría.
- La fila del equipo seguido se resalta con ⭐ en el frontend.

### Próximos partidos

- Filtro Supabase: `status=eq.pendiente`, orden `matchday.asc`, limit 50.
- El backend marca cada partido con `isPast: boolean` según `match_date < hoy`.
- Orden final: futuros/sin-fecha primero (por fecha asc), pasados después (más recientes primero).
- Frontend separa en dos secciones:
  - **"Próximos partidos"**: futuros o sin fecha asignada.
  - **"Partidos pendientes (fechas anteriores)"**: partidos cuya fecha ya pasó pero el status no se actualizó en Supabase. Con nota aclaratoria.
- Agrupación visual: filas consecutivas con misma fecha + jornada ocultan esos valores (efecto rowspan), sin columna de categoría.

### Frontend

```
frontend/src/pages/
├── LigasLayout.tsx              # Sub-nav con un tab por cada LigasConfig + tab Config
├── LigasStandingsPage.tsx        # Tabla de posiciones con filtro de categoría + secciones de próximos partidos
└── LigasConfigPage.tsx           # CRUD de asociaciones liga + equipo
```

- React Query hooks en `api/queries.ts`: `useLigasLeagues`, `useLigasCategories`, `useLigasTeams`, `useLigasStandings`, `useLigasNextMatches`, `useLigasConfigs`, `useLigasCreateConfig`, `useLigasDeleteConfig`.
- Tipos en `api/types.ts`: `Liga`, `LigaCategoria`, `LigaEquipo`, `LigaPosicion`, `LigaProximoPartido` (con `isPast`), `LigasConfig`.
- Stale time: 5–10 minutos.
- Sidebar: ícono Trophy + label "Ligas", condicionado a `enableLigasModule` y permiso `LIGAS`.

### Configuración

- Toggle "Modulo de Ligas Deportivas" en Configuración → Módulos.
- `Setting.enableLigasModule` (default: `false`).
- Al activar, aparece "Ligas" en el sidebar (solo ADMIN).
- En `/admin/ligas/configuracion` se asocian torneos: elegir liga de Supabase → elegir equipo → agregar.
- Cada asociación genera un tab en la sub-nav de `LigasLayout`.

### Variables de entorno

| Variable | Propósito |
|----------|-----------|
| `SUPABASE_URL` | URL base de la instancia Supabase |
| `SUPABASE_ANON_KEY` | Key anónima para consultas REST |

### Consideraciones y troubleshooting

- El módulo **no modifica datos en Supabase**, solo consulta.
- El scraping que popula Supabase es un proceso externo (no incluido en este repo).
- Si una liga no muestra partidos, revisar logs: `"Supabase returned 0 pending matches"` → no hay datos scrapeados para ese equipo/liga.
- Si muestra partidos viejos, aparecen en "Partidos pendientes (fechas anteriores)" con nota aclaratoria. Significa que el scraping no actualizó el status a `finalizado`.
- Los IDs de liga/equipo son UUIDs de Supabase — usar los endpoints `GET` para listarlos, no inventarlos.
- `getTeams` consulta todos los matches de la liga para extraer los team IDs únicos, luego fetchea los detalles en chunks de 50 (límite de `or` en PostgREST).

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
│   │       ├── icons/             # Listado de iconos
│   │       ├── internet-vouchers/  # Vouchers WiFi (integración api-radius)
│   │       ├── ligas/            # Ligas Deportivas (tablas + partidos vía Supabase)
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
│   │       └── users/             # Gestión de usuarios
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

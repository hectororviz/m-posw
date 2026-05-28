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
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PIN` | Admin inicial (PIN tiene prioridad si ambos están) |
| `CAJA01_PASSWORD` | Password de la caja inicial (role USER) |
| `CORS_ORIGIN` | Origen permitido para CORS |
| `VITE_API_BASE_URL` | `/api` (con proxy) o URL completa del backend |
| `MP_ACCESS_TOKEN` / `MP_COLLECTOR_ID` | Mercado Pago (opcionales si usás OAuth) |
| `MP_DEFAULT_EXTERNAL_STORE_ID` / `MP_DEFAULT_EXTERNAL_POS_ID` | IDs de Store/POS en MP (opcionales si usás OAuth) |
| `MP_WEBHOOK_SECRET` | Validación de webhooks de MP |
| `INSTANCE_SUBDOMAIN` | Subdominio usado para construir URL de webhook dinámica |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Credenciales para OAuth Mercado Pago |
| `MP_OAUTH_REDIRECT_URI` | URI de callback para OAuth |
| `MP_INTEGRATOR_ID` | Integrator ID opcional (header X-Integrator-Id) |

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
Conserva: usuarios, configuración, categorías, productos, acreedores.

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

## Acreedores / Fiado Module

Módulo de control de acreedores para ventas fiadas. Permite vender a crédito, registrar acreedores, y hacer seguimiento de deuda con lógica FIFO. Accesible desde `/admin/acreedores` (solo ADMIN). El medio de pago "Fiado" se habilita desde Configuración → Ventas.

### Modelo de datos
```
Acreedor ──1:N──> FiadoVenta ──1:1──> Sale
Acreedor ──1:N──> PagoAcreedor
```
- **Acreedor**: nombre, teléfono, notas, activo/inactivo.
- **FiadoVenta**: ventaId (unique, 1:1 con Sale), acreedorId, monto.
- **PagoAcreedor**: acreedorId, monto, medioPago (efectivo/transferencia), fecha, notas.
- `PaymentMethod.FIADO`: medio de pago en la venta.
- `Setting.enableFiadoPayment`: toggle en Configuración → Ventas.

### Backend
```
backend/src/modules/acreedores/
├── acreedores.module.ts
├── acreedores.controller.ts    # CRUD + deuda + pagos + resumen (ADMIN)
├── acreedores.service.ts       # Lógica FIFO, cálculo de saldos y alertas
└── dto/
    ├── create-acreedor.dto.ts
    ├── update-acreedor.dto.ts
    └── create-pago.dto.ts
```

**Endpoints:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/acreedores` | Lista todos con saldo, alertaDeuda, diasSinPagar |
| `GET` | `/acreedores/resumen` | `{ deudaTotal, acreedoresConDeuda }` |
| `GET` | `/acreedores/:id` | Detalle de un acreedor |
| `POST` | `/acreedores` | Crear acreedor `{ nombre, telefono?, notas? }` |
| `PATCH` | `/acreedores/:id` | Editar acreedor |
| `PATCH` | `/acreedores/:id/toggle` | Alternar activo/inactivo |
| `GET` | `/acreedores/:id/deuda` | FiadoVentas con saldo FIFO, pagos, totales, alerta |
| `POST` | `/acreedores/:id/pagos` | Registrar pago `{ monto, medioPago, fecha, notas? }` |
| `POST` | `/sales/fiado` | Crear venta fiada `{ items, total, paymentMethod, acreedorId }` |

**Lógica FIFO:** Los pagos se aplican a las ventas fiadas por orden cronológico (más antigua primero). La primera venta con saldo restante determina `deudaMasAntigua` y `diasSinPagar`. Si `diasSinPagar >= 30`, se activa `alertaDeuda`.

**Fecha de pago:** Se almacena con `Date.UTC(year, month-1, day, 12, 0, 0)` (mediodía UTC) para evitar desplazamiento de fecha por timezone.

### Frontend
```
frontend/src/pages/
├── AdminAcreedoresPage.tsx       # Lista con KPIs, buscador, orden A-Z/$$$, FAB (+)
└── AdminAcreedorDetailPage.tsx   # Detalle con alerta, ventas fiadas (FIFO), pagos
```

**Flujo de venta fiada en POS:** CheckoutModal → botón "Fiado" → select desplegable de acreedores activos → confirmar → `POST /sales/fiado`.

### Configuración
- **Toggle "Fiado"** en AdminSettingsPage → pestaña Ventas → Medios de pago.
- Por defecto desactivado (`enableFiadoPayment: false`).
- Sin acreedores activos, el select del POS muestra "No hay acreedores activos".

## Theme / Dark Mode

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
│   │       ├── mercadopago-oauth/ # OAuth 2.0 Mercado Pago
│   │       ├── payments/          # Transferencias (polling MP)
│   │       ├── products/          # Productos + recetas
│   │       ├── reports/           # Reportes generales
│   │       ├── sales/             # Ventas + MP Instore + Webhooks + WebSockets
│   │       ├── settings/          # Configuración del sistema
│   │       ├── stats/             # Estadísticas y dashboard
│   │       ├── stock/             # Control de stock
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

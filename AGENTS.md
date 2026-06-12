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
├── internet-vouchers.controller.ts    # Generación/consulta/anulación de vouchers
├── internet-vouchers.service.ts       # Cliente HTTP → api-radius:3001
└── dto/
    ├── create-plan.dto.ts
    ├── update-plan.dto.ts
    └── generate-voucher.dto.ts
```

### Modelos
- **InternetPlan**: define un plan (nombre, duración, ancho de banda, precio). Al crearse, genera automáticamente un `Product` asociado bajo la categoría "Internet".
- **SaleVoucher**: registra cada voucher generado para una venta (PIN, plan, activo). Se crean al confirmar el pago.

### Flujo
1. Admin activa el módulo en Configuración → Módulos → "Vouchers WiFi"
2. Admin crea planes en Internet → cada plan crea automáticamente un producto en la categoría "Internet" (stock=0, ilimitado)
3. En el POS, la categoría "Internet" aparece con los productos de cada plan
4. Al vender un plan de internet, el backend llama a `api-radius:3001/api/vouchers/generate` con los parámetros inline
5. El voucher se genera solo al confirmar el pago (CASH/FIADO: inmediato, MP_QR: vía webhook, TRANSFER: al confirmar)
6. Los PINs se guardan en `SaleVoucher` y se incluyen en el ticket
7. Si se anula la venta, los vouchers se desactivan automáticamente

### Configuración
- `VOUCHER_API_URL`: URL base de api-radius (default: `http://api-radius:3001/api`)
- `Setting.enableInternetModule`: toggle del módulo (default: false)

### Frontend
```
frontend/src/pages/
└── AdminInternetPage.tsx     # CRUD de planes con modal para duración, ancho de banda, precio
```

### Relación con internet-sale
- api-radius es un stack Docker separado (`~/internet-sale`)
- Ambos comparten la red `soler_default` para que el backend de m-posw pueda llamar a `api-radius:3001`
- Los planes se definen en m-posw (fuente de verdad); api-radius acepta parámetros inline vía el endpoint `POST /vouchers/generate`
- `plans.json` en internet-sale es legacy/fallback

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
│   │       ├── internet-vouchers/  # Vouchers WiFi (integración api-radius)
│   │       ├── mercadopago-oauth/ # OAuth 2.0 Mercado Pago
│   │       ├── payments/          # Transferencias (polling MP)
│   │       ├── products/          # Productos + recetas
│   │       ├── reports/           # Reportes generales
│   │       ├── sales/             # Ventas + MP Instore + Webhooks + WebSockets
│   │       ├── settings/          # Configuración del sistema
│   │       ├── socios/            # Padrón de socios + Cuotas + Beneficios + Carnets
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

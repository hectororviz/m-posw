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
| `MP_ACCESS_TOKEN` / `MP_COLLECTOR_ID` | Mercado Pago (solo si usás QR/Transfer) |
| `MP_DEFAULT_EXTERNAL_STORE_ID` / `MP_DEFAULT_EXTERNAL_POS_ID` | IDs de Store/POS en MP (strings, no números) |
| `MP_WEBHOOK_SECRET` | Validación de webhooks de MP |

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

Elimina: ventas, movimientos manuales, cierres de caja, sesiones.
Conserva: usuarios, configuración, categorías, productos.

## Mercado Pago Integration

**Dos métodos distintos:**

1. **QR (Instore v2)**: Webhook async a `/webhooks/mercadopago`. Requiere `externalStoreId` y `externalPosId` configurados por caja en la BD.

2. **Transferencia (CVU/Alias)**: Polling automático a la API de MP. **No usa webhooks**. El frontend consulta periódicamente pagos recientes.

**Endpoints relevantes:**
- `POST /sales/:id/payments/mercadopago-qr` — Crear orden QR
- `POST /sales/:id/payments/mercadopago-qr/cancel` — Cancelar orden
- `POST /payments/transfer/poll` — Buscar transferencias pendientes
- `POST /payments/transfer/confirm` — Confirmar pago por transferencia
- `POST /webhooks/mercadopago` — Webhook de MP

**Configuración MP por caja**: Los campos `externalStoreId` y `externalPosId` en la tabla `User` deben coincidir con los `external_id` configurados en el dashboard de Mercado Pago.

## Important Constraints

- **Migraciones**: Se aplican automáticamente al iniciar el contenedor backend. No ejecutar manualmente en producción a menos que sepas lo que hacés.
- **Seed**: Corre automáticamente si `RUN_SEED=1` (no está en docker-compose por defecto).
- **CORS**: `CORS_ORIGIN` debe incluir el protocolo (ej: `https://tudominio.com`).
- **Uploads**: Se guardan en volumen `uploads_data`, servidos por backend en `/uploads`.
- **Prisma Client**: Se regenera en build de Docker (no hace falta correr `prisma generate` localmente para deploy).

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
│   ├── src/           # Código fuente
│   ├── prisma/        # Schema + migraciones + seed
│   ├── scripts/       # Utilidades
│   └── Dockerfile
├── frontend/          # React + Vite
│   ├── src/
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
4. **QR no genera**: Revisá que `externalStoreId` y `externalPosId` estén configurados para el usuario/caja en la BD.

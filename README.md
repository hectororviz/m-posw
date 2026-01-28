# MiBPS (Mini POS Web)

Sistema de punto de venta web (tablet/celular) para jornadas/eventos. Incluye frontend en Flutter Web, backend NestJS y base de datos PostgreSQL, todo orquestado con Docker Compose.

## Requisitos

- Docker y Docker Compose

## Configuración rápida

```bash
cp .env.example .env
```

Luego levantar todo:

```bash
docker compose up -d --build
```

## URLs

- Frontend: http://localhost:8080
- Backend: http://localhost:3000

## Credenciales iniciales

Se crea un ADMIN inicial desde `.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

También se crea la caja `Caja01` (role USER) con:

- `CAJA01_PASSWORD` (por defecto `Caja01!`)
- `externalPosId=SOLER_POS_001`
- `externalStoreId=SOLER_STORE_001`

## Características principales

- POS táctil: categorías → productos → carrito → venta.
- Roles ADMIN/USER.
- CRUD de usuarios, categorías, productos.
- Personalización (nombre, logo, favicon, color).
- Reportes con filtros por fecha y exportación XLSX.
- Estadísticas con gráficos (últimos 15 días con ventas, últimos 6 meses, promedios diarios).

## CORS

Configurable mediante `CORS_ORIGIN` en `.env`.

## Reset de base de datos (desarrollo)

Para limpiar la base de datos local y reaplicar migraciones:

```bash
cd backend
npx prisma migrate reset --force
```

Si necesitás conservar datos y ya hay una migración fallida, podés resolverla manualmente y ajustar la columna con:

```bash
cd backend
npx prisma migrate resolve --applied 20260315000000_add_mp_qr_and_sessions
psql "$DATABASE_URL" -c 'ALTER TABLE "Session" ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;'
```

## Variables de entorno relevantes

- `DATABASE_URL`: conexión a PostgreSQL (usada por Prisma).
- `JWT_SECRET`: firma de tokens.
- `API_BASE_URL`: inyectado al build de Flutter con `--dart-define`.
- `MP_ACCESS_TOKEN`: token privado de Mercado Pago (solo backend).
- `MP_COLLECTOR_ID`: collector ID de la cuenta MP.
- `MP_DEFAULT_EXTERNAL_STORE_ID`: store por defecto si la caja no define uno.
- `MP_WEBHOOK_SECRET`: secreto opcional para validar webhook (`/webhooks/mercadopago?secret=...`).

## Mercado Pago QR estático

- Cada usuario/caja debe tener `externalPosId` (y opcional `externalStoreId`).
- El backend crea/actualiza órdenes Instore QR v2 al iniciar el cobro.
- Solo puede haber una sesión activa por caja (login único).

### Endpoints

- `POST /sales/:id/payments/mercadopago-qr`
- `POST /sales/:id/payments/mercadopago-qr/cancel`
- `POST /webhooks/mercadopago`
- `GET /sales/:id` (polling de estado)

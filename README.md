# MiBPS (Mini POS Web)

Sistema de punto de venta web (tablet/celular) para jornadas/eventos. Incluye frontend en React + Vite + TypeScript, backend NestJS y base de datos PostgreSQL, todo orquestado con Docker Compose.

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

Al iniciar el contenedor del backend se ejecuta automáticamente `npx prisma migrate deploy` para aplicar migraciones pendientes. Esto mantiene la base alineada con el schema. 

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

## Estado actual del proyecto (resumen funcional)

- Backend NestJS expone endpoints de ventas, usuarios, productos, categorías y reportes.
- Frontend React consume el backend mediante `/api` (proxy) o URL directa.
- Mercado Pago QR está integrado para cobro presencial con órdenes Instore QR v2.
- Persistencia en PostgreSQL con Prisma, incluyendo registros de pagos Mercado Pago y sesiones.

## CORS

Configurable mediante `CORS_ORIGIN` en `.env`.

## Reset de base de datos (desarrollo)

En desarrollo podés ejecutar las migraciones manualmente si no usás Docker:

```bash
cd backend
npx prisma migrate deploy
```

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
- `VITE_API_BASE_URL`: base del backend para el frontend (modo proxy: `/api`, modo directo: `https://backend-host`).
- `VITE_UPLOADS_BASE_URL`: base opcional para imágenes de `/uploads` (si no se define, se usa el ORIGIN de `VITE_API_BASE_URL`).
- `MP_ACCESS_TOKEN`: token privado de Mercado Pago (solo backend).
- `MP_COLLECTOR_ID`: collector ID de la cuenta MP.
- `MP_CURRENCY_ID`: moneda para items/órdenes MP (default `ARS`).
- `MP_DEFAULT_EXTERNAL_STORE_ID`: store por defecto si la caja no define uno.
- `MP_DEFAULT_EXTERNAL_POS_ID`: POS por defecto si la caja no define uno.
- `MP_WEBHOOK_SECRET`: secreto opcional para validar webhook (`/webhooks/mercadopago?secret=...`).

## Mercado Pago QR estático (cobro presencial)

### Datos necesarios para poder cobrar (checklist)

**Configuración en `.env` (backend):**

- `MP_ACCESS_TOKEN`: token privado (Access Token) de la cuenta Mercado Pago.
- `MP_COLLECTOR_ID`: ID del collector (vendedor) asociado a la cuenta.
- `MP_CURRENCY_ID`: moneda de los items (por defecto `ARS`).
- `MP_DEFAULT_EXTERNAL_STORE_ID` / `MP_DEFAULT_EXTERNAL_POS_ID` (opcionales): valores de fallback si la caja/usuario no tiene configurados sus external IDs.
- `MP_WEBHOOK_SECRET` (opcional): secreto compartido para validar el webhook (`/webhooks/mercadopago?secret=...`).

**Configuración por caja/usuario:**

- `externalStoreId`: `external_id` del Store configurado en Mercado Pago.
- `externalPosId`: `external_id` del POS configurado en Mercado Pago.

> Importante: el backend valida que estos IDs NO sean numéricos (deben ser `external_id` string, no el ID interno de MP).

### Notas operativas

- El backend crea/actualiza órdenes Instore QR v2 al iniciar el cobro.
- Solo puede haber una sesión activa por caja (login único).
- El webhook puede protegerse con `MP_WEBHOOK_SECRET` y el query param `?secret=...`.

### Flujo de cobro (resumen)

1. El POS crea una venta y ejecuta `POST /sales/:id/payments/mercadopago-qr`.
2. El backend arma el payload de la orden Instore QR v2 y la crea/actualiza en MP.
3. Mercado Pago envía el webhook a `/webhooks/mercadopago` cuando cambia el estado del pago.
4. El backend registra el pago y marca la venta como `PAID` cuando llega `status=approved`.

### Endpoints relevantes

- `POST /sales/:id/payments/mercadopago-qr`
- `POST /sales/:id/payments/mercadopago-qr/cancel`
- `POST /webhooks/mercadopago`
- `GET /sales/:id` (polling de estado)

### Probar con curl

> Requiere que el usuario/caja tenga `externalPosId` y `externalStoreId` configurados con los external IDs de Mercado Pago (no IDs numéricos).

```bash
curl -X POST "http://localhost:3000/sales/<SALE_ID>/payments/mercadopago-qr" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Para cancelar la orden:

```bash
curl -X POST "http://localhost:3000/sales/<SALE_ID>/payments/mercadopago-qr/cancel" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Frontend (React + Vite)

### Variables de entorno

En `.env`:

```bash
VITE_API_BASE_URL=/api
VITE_UPLOADS_BASE_URL=http://localhost:3000
```

- **Modo proxy**: `VITE_API_BASE_URL=/api` y Nginx proxya `/api` hacia el backend.
- **Modo directo**: `VITE_API_BASE_URL=https://backend-host` (sin proxy).

### Ejemplo Nginx (proxy /api + /uploads)

```nginx
server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://backend:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /uploads/ {
    proxy_pass http://backend:3000/uploads/;
    proxy_set_header Host $host;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

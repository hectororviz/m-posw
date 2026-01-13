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

## Características principales

- POS táctil: categorías → productos → carrito → venta.
- Roles ADMIN/USER.
- CRUD de usuarios, categorías, productos.
- Personalización (nombre, logo, favicon, color).
- Reportes con filtros por fecha y exportación XLSX.
- Estadísticas con gráficos (últimos 15 días con ventas, últimos 6 meses, promedios diarios).

## CORS

Configurable mediante `CORS_ORIGIN` en `.env`.

## Variables de entorno relevantes

- `DATABASE_URL`: conexión a PostgreSQL (usada por Prisma).
- `JWT_SECRET`: firma de tokens.
- `API_BASE_URL`: inyectado al build de Flutter con `--dart-define`.

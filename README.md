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
- `API_BASE_URL_DEV`/`API_BASE_URL_PROD`: URL base para el frontend móvil (soportado por `.env` en `frontend/`).
- `CONFIG_PIN`: PIN opcional para acceder a la pantalla de configuración de backend en la app.

## Flutter Android (frontend)

### Preparación

Dentro de `frontend/`:

```bash
flutter pub get
flutter create .
```

> `flutter create .` generará la carpeta `android/` con los manifiestos y build.gradle necesarios para compilar en Android.

### Ejecutar en Android

```bash
flutter run -d android
```

### Generar APK release

```bash
flutter build apk --release
```

Configura el keystore en `android/app/build.gradle` usando variables de entorno (no subir secretos al repo).

### Configuración de baseUrl por entorno

En `frontend/.env` o `frontend/.env.example`:

```
API_BASE_URL_DEV=http://localhost:3000
API_BASE_URL_PROD=https://api.tu-dominio.com
CONFIG_PIN=1234
```

Puedes seleccionar flavor con:

```bash
flutter run --dart-define=FLAVOR=dev
flutter run --dart-define=FLAVOR=prod
```

Si no hay valor guardado, la app usa la URL por defecto del flavor.

### Cache local de catálogo

- En el primer arranque sin cache, se descarga catálogo completo (`categories` + `products/all`) y se guarda en DB local.
- En siguientes arranques se muestra el catálogo desde cache inmediatamente y se refresca en background si hay red.
- En modo offline la app sigue mostrando el catálogo cacheado en modo lectura.

### Cambiar backend desde la app

1. Entrar a la pantalla **Configuración backend** (ícono de ajustes o gesto oculto).
2. Editar la URL y presionar **Probar conexión**.
3. Guardar: la app valida, normaliza y re-sincroniza catálogo.
4. **Restablecer** vuelve a la URL por defecto del flavor.
5. **Limpiar caché local** borra DB local y cache de imágenes.

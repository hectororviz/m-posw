# m-POSw
Mini POS Web

Sistema de punto de venta web (tablet/celular) para jornadas/eventos. Incluye frontend en React + Vite + TypeScript, backend NestJS y base de datos PostgreSQL, todo orquestado con Docker Compose.

## Descripción general (cómo funciona)

El flujo principal es:

1. El usuario ingresa al POS web desde una tablet/celular o aplicación Android.
2. Selecciona categorías y productos para armar el carrito.
3. Se crea una venta en el backend.
4. Se procesa el cobro (**efectivo, Mercado Pago QR o transferencia**).
5. Se imprime el ticket y se actualizan reportes/estadísticas.

El frontend se comunica con el backend vía API REST (con proxy `/api` o directo a `VITE_API_BASE_URL`). El backend persiste datos en PostgreSQL usando Prisma y expone endpoints para ventas, usuarios, productos, reportes y pagos.

## Arquitectura

- **Frontend**: React + Vite + TypeScript.
- **Backend**: NestJS + Prisma.
- **DB**: PostgreSQL.
- **Infra**: Docker Compose (contenedores para frontend, backend y DB).
- **Integración de pagos**: Mercado Pago Instore QR v2 (webhook de confirmación), Transferencias bancarias (polling de pagos).
- **App Android**: WebView que carga la aplicación web + impresión Bluetooth nativa.

Arquitectura lógica:

```
┌─────────────────────────────────────────────────────────────┐
│                        Clientes                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Tablet     │  │   Celular    │  │   APK Android │     │
│  │  (Browser)   │  │  (Browser)   │  │  (WebView)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Proxy / CDN                            │
│                  (Caddy / Nginx)                            │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │  Frontend    │ │   Backend    │ │  Bluetooth   │
   │   (Nginx)    │ │  (NestJS)    │ │  (APK native)│
   │  :80         │ │  :3000       │ │              │
   └──────────────┘ └──────────────┘ └──────────────┘
                           │
                           │ Prisma
                           ▼
                  ┌──────────────┐
                  │  PostgreSQL  │
                  │    :5432     │
                  └──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
     ┌──────────────┐          ┌──────────────┐
     │ MercadoPago  │          │ Transferencia│
     │    (QR)      │          │  (CVU/Alias) │
     └──────────────┘          └──────────────┘
```

## Requisitos

- Docker y Docker Compose
- (Opcional) Android Studio para compilar la APK

## Configuración rápida

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

Luego levantar todo:

```bash
docker compose up -d --build
```

Al iniciar el contenedor del backend se ejecuta automáticamente `npx prisma migrate deploy` para aplicar migraciones pendientes.

## URLs

- Frontend: http://localhost:8080
- Backend: http://localhost:3000

## Instalación y ejecución (paso a paso)

1. Instalar Docker y Docker Compose.
2. Clonar el repo y crear el `.env`:

   ```bash
   git clone <repo-url>
   cd m-posw
   cp .env.example .env
   ```

3. Configurar variables en `.env`:
   - Credenciales de PostgreSQL (DB)
   - Credenciales de admin (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PIN)
   - Caja01 password (CAJA01_PASSWORD)
   - Configuración de Mercado Pago (MP_ACCESS_TOKEN, MP_COLLECTOR_ID, etc.)
   - Origen de CORS y base URL del frontend

4. Levantar los servicios:

   ```bash
   docker compose up -d --build
   ```

5. Acceder al POS en http://localhost:8080.

## Credenciales iniciales

Se crea un **ADMIN** inicial desde `.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` o `ADMIN_PIN` (si ambos están definidos, usa PIN)

También se crea la caja **Caja01** (role USER) con:

- `CAJA01_PASSWORD`
- `externalPosId` y `externalStoreId` (definidos en seed o per-caja en la BD)

## Métodos de pago soportados

El sistema soporta **tres métodos de pago**:

### 1. Efectivo
- Cobro directo en efectivo.
- Se registra el monto recibido y el vuelto calculado.
- Incluido en el neto de caja.

### 2. Mercado Pago QR (Instore v2)
- Genera un código QR dinámico vía API de Mercado Pago.
- El cliente escanea con su app de MP y paga.
- Confirmación vía webhook (`/webhooks/mercadopago`).
- Requiere configurar `externalStoreId` y `externalPosId` en la caja.

### 3. Transferencia (CVU/Alias)
- Polling automático de pagos recientes en la cuenta de Mercado Pago.
- Detecta transferencias por CVU o `money_transfer`.
- El sistema verifica que el monto coincida y permite confirmar la venta.
- **No usa webhooks**, consulta la API de MP cada X segundos.

## Características principales

- **POS táctil**: categorías → productos → carrito → venta.
- **Múltiples métodos de pago**: Efectivo, QR MP, Transferencia.
- **Roles ADMIN/USER** con permisos diferenciados.
- **CRUD** de usuarios, categorías, productos.
- **Productos Compuestos (Recetas)**: productos que descuentan stock de materias primas.
- **Materias Primas**: insumos con stock decimal para composición de productos.
- **Personalización** (nombre, logo, favicon, color de la UI).
- **Impresión de ticket térmico 80mm** configurable desde Settings.
- **Impresión Bluetooth nativa** desde la APK Android.
- **Cierre de caja** con desglose por método de pago (Efectivo, QR, Transferencia).
- **Reportes** con filtros por fecha y exportación XLSX.
- **Estadísticas** con gráficos (últimos 15 días, últimos 6 meses, promedios).

## Estado actual del proyecto (resumen funcional)

- Backend NestJS expone endpoints de ventas, usuarios, productos, categorías, reportes y pagos.
- Frontend React consume el backend mediante `/api` (proxy) o URL directa.
- **Mercado Pago QR** integrado para cobro presencial con órdenes Instore QR v2.
- **Transferencias** integradas con polling de pagos de MP.
- **APK Android** disponible para impresión Bluetooth nativa.
- Persistencia en PostgreSQL con Prisma, incluyendo registros de pagos y cierres de caja.

## Lenguajes y stack principal

- **Frontend**: TypeScript (React + Vite).
- **Backend**: TypeScript (NestJS + Prisma).
- **DB**: SQL (PostgreSQL).
- **App Android**: Flutter (Dart) + WebView + Bluetooth.
- **Infra**: Docker Compose.

## App Android (APK)

La aplicación Android es un **WebView** que carga la interfaz web desde el servidor, pero agrega funcionalidad nativa para impresión Bluetooth.

### Características de la APK
- Carga automática de la URL configurada (`https://pos.csdsoler.com.ar` por defecto).
- **Impresión térmica Bluetooth** nativa (80mm).
- Botón de impresión integrado en la interfaz web.
- Modo inmersivo (pantalla completa).

### Cómo usar la APK
1. Descargar `app.apk` desde el repositorio.
2. Instalar en tablet/celular Android (permitir "fuentes desconocidas").
3. Al abrir la app, cargará automáticamente el POS web.
4. Desde cualquier pantalla de ticket, presionar el botón de impresora para imprimir vía Bluetooth.

### Desarrollo de la APK
La APK se encuentra en `/m_posw_android/` y usa Flutter + `flutter_inappwebview` + `bluetooth_print_plus`.

Para compilar:
```bash
cd m_posw_android
flutter build apk --release
```

**Nota**: La APK no incluye el código web, solo lo carga desde el servidor. Cualquier cambio en el frontend se refleja inmediatamente sin recompilar la APK.

## Personalización del sitio y del ticket

### Sitio

Desde el panel de administración:

- Cambiar nombre del club/organización.
- Subir logo.
- Definir favicon.
- Ajustar color principal de la UI.

Estos cambios impactan la identidad visual en todo el frontend (login, POS y reportes).

### Ticket

En Settings se puede:

- Definir el nombre del club/organización que se imprime en el ticket.
- Activar o desactivar la impresión automática del ticket térmico (80mm).

La impresión está pensada para impresoras térmicas estándar de 80mm.

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

## Variables de entorno

Ver archivo `.env.example` para ver todas las variables disponibles con descripciones.

### Variables principales

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Conexión a PostgreSQL | ✅ |
| `JWT_SECRET` | Firma de tokens JWT | ✅ |
| `ADMIN_EMAIL` | Email del admin inicial | ✅ |
| `ADMIN_PASSWORD` | Password del admin inicial | ✅ |
| `CAJA01_PASSWORD` | Password de la caja inicial | ✅ |
| `CORS_ORIGIN` | Origen permitido para CORS | ✅ |
| `VITE_API_BASE_URL` | Base URL del backend (`/api` o URL completa) | ✅ |
| `MP_ACCESS_TOKEN` | Token privado de Mercado Pago | Solo para QR/Transfer |
| `MP_COLLECTOR_ID` | ID del collector de MP | Solo para QR |
| `MP_DEFAULT_EXTERNAL_STORE_ID` | Store ID externo de MP (fallback) | Solo para QR |
| `MP_DEFAULT_EXTERNAL_POS_ID` | POS ID externo de MP (fallback) | Solo para QR |
| `MP_WEBHOOK_SECRET` | Secreto para validar webhooks de MP | Recomendado en prod |
| `MP_WEBHOOK_STRICT_PAYMENT` | Rechazar webhooks sin firma (`true`/`false`) | Opcional |

## Integración con Mercado Pago

### QR (Instore v2)

El sistema utiliza **Instore QR v2** para cobros presenciales:

1. Se crea una orden QR al iniciar el cobro.
2. MP muestra el QR al cliente.
3. Cliente escanea y paga desde su app.
4. MP envía webhook a `/webhooks/mercadopago`.
5. Sistema marca la venta como pagada.

### Transferencia (CVU/Alias)

Para cobros por transferencia bancaria:

1. El sistema consulta periódicamente la API de MP.
2. Busca pagos recientes con `payment_method_id=cvu` o `operation_type=money_transfer`.
3. Si encuentra un pago del monto esperado, permite confirmar la venta.
4. No requiere webhook, funciona por polling.

### Checklist de configuración para MP

**En Mercado Pago (dashboard):**
- Crear Store y POS con sus `external_id`.
- Configurar webhook apuntando a `https://tudominio.com/api/webhooks/mercadopago`.
- Obtener Access Token y Collector ID.

**En `.env`:**
```bash
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxx
MP_COLLECTOR_ID=xxxxxxxxxx
MP_DEFAULT_EXTERNAL_STORE_ID=MI_TIENDA_001
MP_DEFAULT_EXTERNAL_POS_ID=MI_CAJA_001
MP_WEBHOOK_SECRET=tu_secreto_aqui
MP_WEBHOOK_STRICT_PAYMENT=true  # en producción
```

**Por caja/usuario (en la BD):**
- `externalStoreId`: Debe coincidir con el external_id del Store en MP.
- `externalPosId`: Debe coincidir con el external_id del POS en MP.
- ⚠️ **Importante**: Estos IDs deben ser strings alfanuméricos, NO números.

### Endpoints relevantes de MP

- `POST /sales/:id/payments/mercadopago-qr` - Crear orden QR
- `POST /sales/:id/payments/mercadopago-qr/cancel` - Cancelar orden QR
- `POST /payments/transfer/poll` - Buscar transferencias pendientes
- `POST /payments/transfer/confirm` - Confirmar pago por transferencia
- `POST /webhooks/mercadopago` - Webhook de MP

## Frontend (React + Vite)

### Variables de entorno

En `.env`:

```bash
VITE_API_BASE_URL=/api
VITE_UPLOADS_BASE_URL=http://localhost:3000
```

- **Modo proxy**: `VITE_API_BASE_URL=/api` y Nginx/Caddy proxya `/api` hacia el backend.
- **Modo directo**: `VITE_API_BASE_URL=https://backend-host` (sin proxy).

### Ejemplo Caddy (proxy /api + /uploads)

```caddy
tudominio.com {
  encode gzip

  handle_path /api/* {
    reverse_proxy pos-backend:3000
  }

  handle_path /uploads/* {
    reverse_proxy pos-backend:3000
  }

  handle {
    reverse_proxy pos-frontend:80
  }
}
```

## Desarrollo

### Estructura del proyecto

```
m-posw/
├── backend/           # NestJS + Prisma
│   ├── src/
│   ├── prisma/
│   └── Dockerfile
├── frontend/          # React + Vite
│   ├── src/
│   ├── dist/
│   └── Dockerfile
├── m_posw_android/    # Flutter APK
│   ├── android/
│   └── lib/
├── docker-compose.yml
├── .env.example
└── README.md
```

### Comandos útiles

```bash
# Levantar todo
docker compose up -d --build

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild solo frontend
docker compose up -d --build frontend

# Reiniciar backend
docker compose restart backend

# Acceder a la DB
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB

# Prisma (desde backend/)
npx prisma migrate dev     # Crear migración
npx prisma migrate deploy  # Aplicar migraciones
npx prisma studio          # GUI de Prisma
```

## Licencia

Programa confeccionado íntegramente con IA (Codex)

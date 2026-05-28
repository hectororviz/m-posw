# m-POSw — Mini POS Web

Sistema de punto de venta web para tablet/celular, diseñado para jornadas, eventos y comercios que necesitan cobrar con agilidad usando **efectivo, Mercado Pago QR o transferencia bancaria**.

## Funcionalidades

### Punto de venta
- Interfaz táctil optimizada: **categorías → productos → carrito → venta**.
- Múltiples métodos de pago en una misma pantalla (efectivo, QR, transferencia).
- Impresión de ticket térmico 58mm (automática o manual).
- Cálculo automático de vuelto en pagos en efectivo.
- **Zoom de productos**: vista ampliada en el POS táctil.

### Pagos
- **Efectivo**: registro de monto recibido, vuelto calculado.
- **Mercado Pago QR** (Instore v2): genera un QR dinámico que el cliente escanea con su app de MP. Confirmación instantánea vía webhook.
- **Transferencia bancaria** (CVU/Alias): el sistema detecta automáticamente la transferencia en la cuenta de MP y confirma la venta.
- **OAuth Mercado Pago**: vinculá tu cuenta de MP vía OAuth 2.0 sin configurar tokens manualmente. Detección automática de tiendas, creación de POS QR y renovación proactiva de tokens.

### Tesorería / Libro Diario
- **Partida doble**: registrá asientos contables con débito y crédito validados automáticamente.
- **Plan de cuentas**: estructura jerárquica de cuentas (Activo, Pasivo, Patrimonio, Ingresos, Egresos). Cuentas agrupadoras y cuentas imputables.
- **Ciclo contable**: asientos en borrador (DRAFT) → contabilizados (POSTED) → anulados (VOIDED) con reversión automática.
- **Reportes exportables a Excel**: Libro Diario, Mayor Contable, Balance de Sumas y Saldos, Estado de Resultados, Disponibilidades.

### Gestión de productos
- CRUD de categorías y productos con imágenes personalizadas.
- **Productos Compuestos (Recetas)**: al vender un producto, se descuenta stock de sus materias primas automáticamente.
- **Materias Primas**: insumos con stock decimal para composición de recetas.
- Control de stock en tiempo real con ajuste rápido (quick adjust) y autoguardado.

### Administración
- **Panel de reportes**: ventas por fecha, totals, métricas con filtros y exportación XLSX.
- **Dashboard de estadísticas**: KPIs con badges, últimos 15 días, últimos 6 meses, promedios con gráficos.
- **Cierre de caja**: desglose por método de pago (efectivo, QR, transferencia) con movimientos de entrada/salida.
- **Gestión de usuarios**: creación, edición y eliminación de usuarios desde la pestaña de Configuración.

### Personalización
- Nombre del comercio/club, logo, favicon y color principal de la UI configurable desde el panel admin.
- Encabezado del ticket personalizable.
- **Modo Oscuro**: tema dark completo con toggle manual y detección automática de preferencia del sistema.
- **Sidebar colapsable**: navegación responsive con toggle, ideal para pantallas pequeñas.

### Roles y seguridad
- **ADMIN**: acceso completo a configuración, reportes, tesorería y gestión de usuarios.
- **USER** (caja): acceso restringido al POS y a sus propias ventas.
- Autenticación JWT con sesiones revocables.

## Casos de uso

| Escenario | Cómo se usa m-POSw |
|-----------|-------------------|
| **Jornada deportiva / evento** | Puestos de comida y bebida con tablet. Categorías táctiles, cobro rápido con QR o efectivo. Varias cajas operando en simultáneo. |
| **Cantina / buffet escolar** | Productos compuestos (ej: "Combo Hamburguesa" descuenta pan, carne y aderezos del stock). Control de insumos automatizado. Contabilidad por partida doble para rendición. |
| **Feria / puesto callejero** | App Android en celular con impresión Bluetooth. Sin necesidad de PC ni instalación compleja. |
| **Comercio minorista** | Catálogo de productos con imágenes, múltiples métodos de cobro, cierre de caja diario, libro diario contable. |
| **Evento con múltiples puestos** | Cada puesto es una caja independiente. Admin centralizado que ve reportes, estadísticas y tesorería de todas las cajas. |

## Ventajas

- **Sin instalación**: funciona en cualquier navegador (tablet, celular, PC). Solo se necesita WiFi.
- **Multiplataforma**: mismo sistema accesible desde navegador web, APK Android con impresión nativa, o cualquier dispositivo con internet.
- **Despliegue simple**: un solo `docker compose up -d --build` levanta todo el stack. Sin dependencias externas excepto Docker.
- **Actualización centralizada**: los cambios en el frontend se reflejan inmediatamente en todos los dispositivos sin recompilar nada (ni siquiera la APK).
- **Múltiples métodos de pago**: efectivo, QR y transferencia en una misma pantalla. No hacen falta terminales POS físicas.
- **Control de inventario inteligente**: productos compuestos con recetas que descuentan automáticamente el stock de materias primas.
- **Impresión sin drivers**: desde el navegador (ticket térmico 58mm estándar) o desde la APK vía Bluetooth nativo. Sin instalar drivers de impresora.
- **OAuth Mercado Pago**: vinculación en 2 clics sin copiar tokens manualmente. Renovación automática, nunca se vence.
- **Contabilidad integrada**: libro diario con partida doble, plan de cuentas y reportes contables. Ideal para rendir cuentas a tesorerías de clubes o instituciones.
- **Código abierto**: generado íntegramente con IA, adaptable a cualquier necesidad.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | NestJS 10 + Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Infraestructura | Docker Compose (3 contenedores) |
| Pagos | API Mercado Pago (Instore QR v2 + OAuth 2.0 + Search payments) |
| Comunicación en tiempo real | WebSockets (Socket.IO) |
| App Android | Flutter + WebView + impresión Bluetooth nativa |
| Estilos | CSS Variables + Modo Oscuro |
| Reportes | ExcelJS (exportación XLSX) |
| Reverse proxy | Nginx (frontend) + Caddy/Nginx externo (opcional) |

## Requerimientos del servidor

### Mínimos (para 1-3 cajas concurrentes)

| Recurso | Valor |
|---------|-------|
| CPU | 1 vCPU |
| RAM | 1 GB |
| Disco | 10 GB |
| Sistema operativo | Linux (Ubuntu 20.04+, Debian 11+) |
| Software | Docker 24+ y Docker Compose v2 |
| Red | IP pública o dominio con HTTPS (Let's Encrypt) |

### Recomendados (para 5+ cajas concurrentes)

| Recurso | Valor |
|---------|-------|
| CPU | 2 vCPU |
| RAM | 2 GB |
| Disco | 20 GB SSD |

### Requisitos de red

- La red Docker `shared_proxy` debe existir antes de levantar los contenedores:
  ```bash
  docker network create shared_proxy
  ```
- Puerto **80/443** expuestos para el frontend (HTTPS recomendado vía Caddy/Nginx externo).
- Puerto **3000** para el backend (solo interno o para debug).
- **Webhook de Mercado Pago**: el endpoint `https://tudominio.com/api/webhooks/mercadopago` debe ser accesible desde internet si se usa QR.

### Servicios externos necesarios

- **Mercado Pago**: cuenta de desarrollador (gratuita). Con OAuth, la vinculación es automática. Sin OAuth, se requiere Access Token configurado manualmente.
- **Proxy reverso con HTTPS**: Caddy o Nginx externo para terminación SSL (no incluido en el docker-compose).

## App Android (APK)

### ¿Por qué una APK?

La aplicación web funciona perfectamente desde cualquier navegador móvil. Sin embargo, los navegadores **no tienen acceso a Bluetooth** para imprimir tickets térmicos. La APK resuelve esto proporcionando una capa nativa mínima que:

1. Carga la misma interfaz web del POS en un **WebView** (pantalla completa, modo inmersivo).
2. Agrega **impresión Bluetooth nativa**: al presionar el botón de imprimir en la web, la APK captura el evento y envía el ticket a la impresora térmica por Bluetooth directamente.

La APK **no contiene el código de la aplicación**: solo es un "envoltorio" que agrega la funcionalidad que el navegador no puede ofrecer. Cualquier cambio en el frontend se refleja al instante sin necesidad de recompilar o redistribuir la APK.

### Cómo funciona

```
┌──────────────────────────────────────────┐
│               APK Android                 │
│  ┌────────────────────────────────────┐  │
│  │          WebView                   │  │
│  │  Carga https://pos.tudominio.com   │  │
│  │  (la misma web que el navegador)   │  │
│  └──────────────┬─────────────────────┘  │
│                 │ mensaje JS              │
│                 ▼                         │
│  ┌────────────────────────────────────┐  │
│  │     Bridge Nativo (Flutter)        │  │
│  │  Recibe datos del ticket vía       │  │
│  │  JavaScript → imprime por Bluetooth │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

La comunicación entre el frontend (JS) y la APK (Flutter) se hace mediante `postMessage` / `addJavaScriptHandler`: cuando el usuario toca "Imprimir", el frontend envía los datos del ticket como JSON. El código nativo Flutter los recibe, formatea el ticket para impresora térmica 58mm y lo envía por Bluetooth.

### Cómo usar la APK

1. Compilar con `flutter build apk --release` desde `m_posw_android/`.
2. Instalar el `.apk` en la tablet/celular Android.
3. Vincular la impresora térmica Bluetooth desde los ajustes de Android.
4. Abrir la app: carga el POS automáticamente.
5. Desde cualquier pantalla de ticket, presionar el botón de impresora.

### Dependencias Flutter

| Paquete | Función |
|---------|---------|
| `flutter_inappwebview` | WebView con bridge JS ↔ nativo |
| `print_bluetooth_thermal` | Impresión térmica por Bluetooth |
| `esc_pos_utils_plus` | Formateo de tickets ESC/POS |
| `permission_handler` | Permisos de Bluetooth en Android |
| `shared_preferences` | Guardar URL del servidor y configuración |

## Quick Start (Docker)

```bash
# 1. Crear red Docker (si no existe)
docker network create shared_proxy

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores reales

# 3. Levantar los servicios
docker compose up -d --build

# 4. Acceder
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
```

## Variables de entorno principales

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Clave de firma para tokens JWT |
| `ADMIN_EMAIL` | Email del usuario administrador inicial |
| `ADMIN_PASSWORD` | Contraseña del admin (o usar `ADMIN_PIN`) |
| `CAJA01_PASSWORD` | Contraseña de la caja inicial (rol USER) |
| `CORS_ORIGIN` | Origen permitido para CORS (con protocolo) |
| `VITE_API_BASE_URL` | `/api` si usás proxy, o URL completa del backend |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (opcional si usás OAuth) |
| `MP_COLLECTOR_ID` | Collector ID de Mercado Pago (opcional si usás OAuth) |
| `MP_DEFAULT_EXTERNAL_STORE_ID` | Store ID externo configurado en MP (opcional si usás OAuth) |
| `MP_DEFAULT_EXTERNAL_POS_ID` | POS ID externo configurado en MP (opcional si usás OAuth) |
| `MP_WEBHOOK_SECRET` | Secreto para validar webhooks de MP |
| `INSTANCE_SUBDOMAIN` | Subdominio de la instancia para webhook URL dinámica |
| `MP_CLIENT_ID` | Client ID para OAuth de Mercado Pago |
| `MP_CLIENT_SECRET` | Client Secret para OAuth de Mercado Pago |
| `MP_OAUTH_REDIRECT_URI` | URI de callback para OAuth de MP |
| `MP_INTEGRATOR_ID` | Integrator ID opcional para partners certificados |

Ver `.env.example` para la lista completa.

## Credenciales iniciales

Al iniciar por primera vez, el seed crea:

- **Admin**: `ADMIN_EMAIL` + `ADMIN_PASSWORD` (o `ADMIN_PIN`, que tiene prioridad si ambos están definidos).
- **Caja01**: usuario con rol USER y `CAJA01_PASSWORD`.

## Métodos de pago

### 1. Efectivo
El cajero ingresa el monto recibido y el sistema calcula el vuelto automáticamente. Se registra en el neto de caja.

### 2. Mercado Pago QR (Instore v2)
1. El sistema crea una orden QR en MP usando las credenciales OAuth (o Access Token del .env).
2. El cliente escanea el QR con su app de Mercado Pago.
3. MP notifica al backend vía webhook (`/api/webhooks/mercadopago`).
4. La venta se marca como pagada automáticamente.

**Con OAuth**: la configuración de Store/POS se hace automáticamente al vincular la cuenta. **Sin OAuth**: requiere `externalStoreId` y `externalPosId` configurados por caja.

### 3. Transferencia bancaria
1. El sistema consulta periódicamente los pagos recientes de la cuenta de MP.
2. Filtra por transferencias CVU o `money_transfer`.
3. Si el monto coincide, el cajero confirma la venta.

**No usa webhooks**: funciona por polling contra la API de MP.

### 4. OAuth Mercado Pago (nuevo en v2)
Vinculá tu cuenta de Mercado Pago en 2 clics desde Configuración → Mercado Pago:
1. Hacé clic en "Conectar Mercado Pago" — se abre la autorización de MP.
2. Al volver, el sistema detecta automáticamente tus tiendas y POS existentes.
3. Seleccioná una tienda existente o creá una nueva automáticamente.
4. Los tokens se renuevan automáticamente cada 6 horas. No se vencen.

## Módulo de Tesorería (nuevo en v2)

Accesible desde el panel admin en **Tesorería**, con 4 secciones:

| Sección | Descripción |
|---------|-------------|
| **Resumen** | Dashboard con disponibilidades (efectivo, MP, banco), totales de ingresos/egresos y últimos asientos. |
| **Movimientos** | CRUD de asientos contables. Alta de ingresos/egresos simplificados. Numeración automática. Ciclo DRAFT → POSTED → VOIDED. |
| **Plan de cuentas** | Estructura jerárquica de cuentas contables (Activo, Pasivo, Patrimonio, Ingresos, Egresos). Cuentas agrupadoras y cuentas imputables. |
| **Reportes** | Libro Diario, Mayor Contable, Balance de Sumas y Saldos, Estado de Resultados y Disponibilidades. Todos exportables a Excel. |

## Desarrollo

### Backend

```bash
cd backend
npm install
npm run start:dev     # Modo watch (http://localhost:3000)
npm test              # Jest: busca *.spec.ts
npx prisma studio     # GUI de base de datos
```

### Frontend

```bash
cd frontend
npm install
npm run dev           # Vite dev server
npm run build         # Build de producción
```

### Android APK

```bash
cd m_posw_android
flutter build apk --release
```

### Base de datos

```bash
# Reset completo (desarrollo)
cd backend && npx prisma migrate reset --force

# Limpiar solo datos operativos (conserva usuarios/config/productos)
./limpiar-datos-operativos.sh --yes
```

### Deploy

```bash
./deploy.sh   # git pull + docker compose build + up
```

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                     Clientes                              │
│   Navegador web (tablet/celular/PC)  │  APK Android      │
└──────────────────────┬───────────────┴───────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────┐
│               Proxy reverso (Caddy/Nginx)                 │
│        /api/* → backend:3000   /uploads/* → backend:3000  │
│        / → frontend:80                                    │
└──────────────────────┬───────────────────────────────────┘
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ Frontend │ │ Backend  │ │ PostgreSQL   │
   │ Nginx:80 │ │ NestJS   │ │ :5432        │
   └──────────┘ │ :3000    │ └──────────────┘
                └────┬─────┘
                     │ API Mercado Pago
                     ▼
         ┌──────────────────────┐
         │   Mercado Pago       │
         │  OAuth │ QR │ Transf │
         └──────────────────────┘
```

## Licencia

MIT

Programa confeccionado íntegramente con IA (Codex)

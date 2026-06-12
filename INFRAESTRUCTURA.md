# Infraestructura WiFi — Stack externo a m-POSw

Este documento describe todo lo necesario **fuera de m-POSw** para que funcione la venta de vouchers de internet WiFi: el stack `internet-sale`, la configuración de red, MikroTik, y servicios complementarios.

---

## 1. Stack `internet-sale`

Repositorio en el servidor: `~/internet-sale`. Es un stack Docker Compose con 4 servicios.

### 1.1 Servicios

| Servicio | Imagen | Puerto | Descripción |
|----------|--------|--------|-------------|
| `postgres-radius` | `postgres:16-alpine` | — (interno) | Base de datos de vouchers y accounting RADIUS |
| `api-radius` | Custom (`api-radius/Dockerfile`) | 3001 (interno) | API REST para generar/consultar/anular vouchers |
| `freeradius` | Custom (`freeradius/Dockerfile`) | 1812/udp, 1813/udp | Servidor RADIUS (auth + accounting) |
| `portal` | `nginx:alpine` | 80 (via Caddy) | Portal cautivo — página de login WiFi |

### 1.2 Redes Docker

Tres redes, **dos externas** (deben existir antes de levantar el stack):

| Red | Tipo | Propósito |
|-----|------|-----------|
| `radius_internal` | Interna | Comunicación entre los 4 servicios del stack |
| `caddy_net` | Externa | Conexión al reverse proxy Caddy para HTTPS en el portal |
| `soler_default` | Externa | **Compartida con m-POSw** — permite que el backend de m-posw llame a `api-radius:3001` |

Crear las redes externas si no existen:

```bash
docker network create caddy_net
docker network create soler_default
```

### 1.3 Variables de entorno (`.env`)

Archivo `.env` en `~/internet-sale/`:

```env
RADIUS_DB_NAME=radius
RADIUS_DB_USER=radius_user
RADIUS_DB_PASS=<password seguro>
RADIUS_SECRET=<clave compartida RADIUS, mínimo 32 chars>
API_RADIUS_PORT=3001
SSID_PUBLIC=Internet_CSD
PORTAL_URL=https://portal.csdsoler.com.ar
```

- `RADIUS_SECRET`: misma clave que se configura en el MikroTik (NAS client) y en `freeradius/config/clients.conf`
- `SSID_PUBLIC`: nombre de la red WiFi que verán los clientes

### 1.4 Comandos

```bash
cd ~/internet-sale

# Iniciar stack
docker compose up -d

# Rebuildear imágenes (solo api-radius y freeradius tienen Dockerfile)
docker compose build api-radius freeradius

# Ver logs
docker compose logs -f api-radius
docker compose logs -f freeradius

# Bajar
docker compose down

# Resetear DB (borra vouchers y accounting)
docker compose down -v
```

Solo `api-radius` y `freeradius` tienen Dockerfile propio. Los otros dos usan imágenes públicas.

### 1.5 Base de datos

Schema en `init.sql`. Se aplica automáticamente al crear el contenedor por primera vez. Si el volumen `postgres_radius_data` ya existe, **no se re-ejecuta**. Para reiniciar desde cero:

```bash
docker compose down -v
docker compose up -d
```

Dos tablas bajo el schema `radius`:

- **`radius.vouchers`**: PIN, plan, duración, ancho de banda, MAC binding, expiración, sale_id
- **`radius.accounting`**: sesiones RADIUS (username, IP, MAC, bytes, start/stop)

**IMPORTANTE**: La columna `sale_id` debe ser `VARCHAR(50)`, no `INTEGER`. m-posw envía UUIDs como sale_id. La migración ya está corregida en `init.sql`.

### 1.6 API (api-radius)

Base path `/api` en puerto 3001. **Solo accesible desde la red interna** (nunca expuesto públicamente).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Healthcheck (verifica DB) |
| `GET` | `/api/plans` | Listar planes (legacy, desde `plans.json`) |
| `POST` | `/api/vouchers/generate` | Generar voucher. Modo legacy: `{plan_id, sale_id?}`. Modo inline: `{plan_name, duration, download, upload, idle_timeout?, sale_id?}` |
| `GET` | `/api/vouchers/:pin` | Consultar estado de un voucher |
| `DELETE` | `/api/vouchers/:pin` | Anular un voucher |
| `POST` | `/api/vouchers/deactivate-by-sale` | Anular todos los vouchers de una venta `{sale_id}` |

**Formato de PIN**: `XXXX-XXXX` (8 caracteres alfanuméricos, sin `0/O/1/I/l`).

### 1.7 Comportamiento de los vouchers

- **MAC binding**: en el primer login exitoso, la MAC del dispositivo queda registrada. Logins posteriores desde otra MAC son rechazados.
- **Timer inicia al primer uso**: `first_use_at` y `expires_at` se calculan cuando el cliente se conecta, no al generar el voucher.
- **Ancho de banda**: FreeRADIUS responde con atributos `WISPr-Bandwidth-Max-Down` y `WISPr-Bandwidth-Max-Up` (compatibles con MikroTik).

---

## 2. MikroTik — Configuración del hotspot

### 2.1 Servidor RADIUS

En WinBox o terminal MikroTik:

```
/radius add address=<IP_DEL_SERVIDOR> secret=<RADIUS_SECRET> service=hotspot
/radius incoming set accept=yes
```

Donde `<IP_DEL_SERVIDOR>` es la IP del host Docker donde corre `freeradius` (puertos 1812/udp y 1813/udp expuestos).

### 2.2 Perfil de hotspot

```
/ip hotspot profile set [find] use-radius=yes
```

### 2.3 Server hotspot

Configurar el hotspot server para que use el perfil con RADIUS:

```
/ip hotspot server set [find] address-pool=<pool> disabled=no
```

### 2.4 Portal cautivo

El portal (`portal/index.html`) es una página de login compatible con MikroTik. Usa las variables del hotspot:
- `$(link-login-only)` — URL de login
- `$(mac)` — MAC del cliente
- `$(error)` — mensaje de error

El portal se expone vía Caddy en `https://portal.csdsoler.com.ar`. Para que MikroTik lo use, configurar:

```
/ip hotspot walled-garden ip add dst-host=portal.csdsoler.com.ar
```

O usar el método `walled-garden` si el portal está en un dominio externo.

### 2.5 Verificación

1. Conectarse a la red WiFi `Internet_CSD`
2. El portal cautivo debe aparecer pidiendo el PIN
3. Ingresar un PIN generado por el POS
4. Debe autenticar y navegar

Para debug:

```bash
docker logs -f freeradius    # Ver intentos de auth
docker logs -f api-radius    # Ver generación de vouchers
```

En MikroTik:
```
/log print where topics~"radius"
/radius monitor
```

---

## 3. Caddy — Reverse Proxy

Caddy es el reverse proxy que provee HTTPS para todos los servicios. Corre en un container separado.

### 3.1 Dominios requeridos

| Dominio | Servicio |
|---------|----------|
| `soler.mposw.com.ar` | m-POSw (frontend) |
| `api.soler.mposw.com.ar` | m-POSw (backend API) |
| `portal.csdsoler.com.ar` | Portal cautivo WiFi |
| `oauth.mposw.com.ar` | Callback OAuth MercadoPago |

### 3.2 Red Docker

Todos los servicios que usan Caddy deben estar en la red `caddy_net`:

```bash
docker network create caddy_net   # si no existe
```

Los containers que necesitan Caddy deben declarar `caddy_net` como red externa y usar labels para que Caddy los detecte automáticamente:

```yaml
networks:
  - caddy_net
labels:
  caddy: tudominio.com.ar
  caddy.reverse_proxy: "{{upstreams 80}}"
```

---

## 4. Landing page

La landing page (`mposw.com.ar`) es un sitio estático que presenta m-POSw. Puede estar hosteada en el mismo Caddy o en un servicio separado. No es necesaria para el funcionamiento del sistema; es solo informativa/marketing.

---

## 5. Integración con m-POSw

### 5.1 Conexión de red

El backend de m-posw debe estar en la misma red Docker que `api-radius`. En la instancia de producción (soler), ambas están en `soler_default`. Esto se configura en el `docker-compose.yml` de la instancia.

### 5.2 Variable de entorno en m-POSw

En el `.env` de la instancia de m-posw:

```env
VOUCHER_API_URL=http://api-radius:3001/api
```

La resolución DNS `api-radius` funciona porque ambos containers están en la misma red Docker.

### 5.3 Activación del módulo

1. Ir a m-POSw → Configuración → Módulos
2. Activar "Vouchers WiFi"
3. Ir a Internet → Planes → Crear plan
4. El plan crea automáticamente un producto en la categoría "Internet" del POS

### 5.4 Dependencias

El stack `internet-sale` debe estar corriendo antes de que m-posw intente vender vouchers. Si `api-radius` no está disponible, las ventas de internet fallarán (el voucher no se genera), pero el resto del POS sigue funcionando.

---

## 6. Troubleshooting

### Los vouchers no se generan

1. Verificar que `enableInternetModule = true` en la tabla `Setting` de m-posw
2. Verificar que `VOUCHER_API_URL=http://api-radius:3001/api` esté en el `.env` de la instancia
3. Verificar conectividad: `docker exec <backend> node -e "require('http').get('http://api-radius:3001/api/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log(d)) })"`
4. Ver logs del backend: `docker logs soler-backend-1 | grep -i voucher`

### Error "socket hang up" al generar voucher

La columna `sale_id` en `radius.vouchers` es `INTEGER` pero m-posw manda UUIDs. Corregir:

```sql
ALTER TABLE radius.vouchers ALTER COLUMN sale_id TYPE VARCHAR(50);
```

También verificar que `init.sql` tenga `VARCHAR(50)` para futuros deploys.

### MikroTik no autentica

1. Verificar que `RADIUS_SECRET` coincida entre `.env` y la configuración de MikroTik
2. Verificar que los puertos 1812/udp y 1813/udp estén expuestos y accesibles desde el MikroTik
3. En MikroTik: `/log print where topics~"radius"`
4. En el servidor: `docker logs -f freeradius`

### La categoría Internet no aparece en el POS

1. Verificar que el módulo esté activado en Configuración → Módulos
2. Verificar que existan planes en Internet → Planes
3. Verificar que la categoría "Internet" tenga `active = true` en la DB

### El PIN no aparece en el ticket

1. Verificar que el frontend de m-posw tenga la última versión (incluye el CSS `.ticket-voucher-*`)
2. Verificar que la generación de vouchers funcione (ver logs del backend)
3. Si es MP_QR, el webhook puede tardar unos segundos — el frontend re-fetchea la venta

---

## 7. Puertos expuestos

| Puerto | Servicio | Protocolo | Expuesto |
|--------|----------|-----------|----------|
| 80 | Caddy (todos los servicios web) | TCP | Público |
| 443 | Caddy (HTTPS) | TCP | Público |
| 1812 | FreeRADIUS (auth) | UDP | Al MikroTik |
| 1813 | FreeRADIUS (accounting) | UDP | Al MikroTik |
| 3001 | api-radius | TCP | Solo red interna |
| 5432 | postgres-radius | TCP | Solo red interna |
| 3000 | m-POSw backend | TCP | Solo red interna |

---

## 8. Resumen de despliegue mínimo

Para poner en marcha el sistema completo en un servidor nuevo:

```bash
# 1. Redes Docker
docker network create caddy_net
docker network create soler_default

# 2. Clonar repos
git clone <m-posw> ~/m-posw
git clone <internet-sale> ~/internet-sale

# 3. Configurar .env en ambos proyectos

# 4. Levantar internet-sale
cd ~/internet-sale && docker compose up -d

# 5. Crear instancia de m-posw
cd ~/m-posw && docker compose build backend frontend
cd ~/srv/mposw/scripts && ./make_instancia.sh   # o configurar manualmente

# 6. Activar módulo desde el panel admin de m-posw
#    Configuración → Módulos → Vouchers WiFi
#    Internet → Planes → Crear plan

# 7. Configurar MikroTik (ver sección 2)
# 8. Configurar DNS/Caddy para los dominios (ver sección 3)
```

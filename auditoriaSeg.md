# Auditoría de seguridad — m-POSw (revisión v2)

> Fase de auditoría (sin cambios en código, config, migraciones, dependencias ni infra).
> **Revision v2** incorpora las aclaraciones del equipo:
> (1) las credenciales que estuvieron en `.env` **ya fueron rotadas**;
> (2) en este sistema `CONFIGURACION=FULL` equivale al permiso administrativo `ADMIN`;
> (3) la integración WhatsApp está próxima a discontinuarse.
>
> Alcance inspeccionado v2: `backend/` (NestJS+Prisma), `frontend/` (React+Vite), `docker-compose.yml`, `Dockerfile`s, `nginx.conf`, `.github/workflows/`, `.env.example`, historial Git y esquema Prisma. Sin acceso a infraestructura en ejecución ni llamadas a terceros.

---

## A. Resumen ejecutivo (v2)

Cambios de evaluación respecto de la v1:

- **SEC-01 (secretos en Git):** las credenciales fueron **rotadas**, por lo que el impacto de explotación bajó de *compromiso total* a *exposición histórica*. Persiste en el historial de Git y requiere **limpieza coordinada** (no re-rotar). Estado: **confirmado — limpieza pendiente**.
- **SEC-02 (administración de usuarios):** verificado el modelo real. `CONFIGURACION=FULL` es admin-equivalente; no hay ruta para que un actor por debajo de ese nivel lo obtenga ni para escalar por encima. Se reclasifica a **no aplica / falso positivo**, con una observación de defensa en profundidad. Estado: **resuelto como hallazgo**.
- **SEC-03 (webhook WhatsApp):** sin verificación de firma. Al estar en retiro, se propone **corrección mínima urgente** + plan de desmantelamiento. Estado: **confirmado**.

Riesgos que quedan tras la revisión, en orden real:

1. **SEC-04 (WebSocket sin auth)** — fuga de estado de pago de ventas. Único hallazgo de severidad media-alta vigente.
2. **SEC-06 (secretos en BD + permisos de archivo)** — tokens en claro en `Setting` y `.env*` con permisos `664`.
3. **SEC-17 (rate limiting / confianza en XFF, ex SEC-14)** — bucketing de throttler potencialmente incorrecto por topología de proxies y conteo webhook evadible.
4. **SEC-05, SEC-07, SEC-08, SEC-09, SEC-12, SEC-13, SEC-16** — confirmados de severidad media/baja, con distinto impacto funcional y esfuerzo.

Sin inyección SQL, sin CSRF clásico (Bearer, no cookies) y sin cobros calculados en cliente (total/descuentos recalculados y comparados en servidor).

---

## A bis. Verificaciones realizadas en v2 (evidencia)

- **Rotación/secretos:** `.env` ya no está rastreado (`git ls-files`), pero sigue en el historial (`git log --all -- .env` → commits `bdc03d3`, `2a2ec35`); `git log --all -S'APP_USR-'` reporta 10 commits. `.env` y `.env.bak-*` en disco conservan permisos `-rw-rw-r--` (664).
- **Permisos:** el único camino de escritura de permisos es `UsersController` (requiere `CONFIGURACION=FULL`) → `UserPermissionsService.setPermissions`. `pos-device.service.ts:94-98` solo hace `upsert` de `POS=FULL` para el usuario `pos-terminal`. No existe controlador de perfil propio (`/me`, `/profile`).
- **Inmutabilidad de ADMIN:** `users.service.ts:130-132,199-205` bloquea modificar/eliminar al ADMIN; `user-permissions.service.ts:53-55` bloquea editar permisos del ADMIN; el DTO no expone `role` y `create` fuerza `role:'USER'` (`users.service.ts:33`).
- **WebSocket:** el frontend envía `auth:{token}` (`SocketProvider.tsx:22-29`) pero el gateway no lo lee ni valida (`sales.gateway.ts`), y `sale.join` no autoriza por venta.
- **QR socios:** único consumidor es el frontend autenticado (`SocioQrModal.tsx:106` vía `apiClient` con JWT). La terminal usa `/entradas/socios/:uuid` (DeviceGuard). El endpoint `/socios/qr/:uuid` no tiene guard.
- **Settings:** `useSettings` (GET `/settings`) lo consumen POS (`CartPanel`, `CheckoutModal`), `AppLayout`, `AdminSalesPage`, `AdminStatsPage`; si da 401 cae a `/settings/public`. Exigir `CONFIGURACION` tendría impacto funcional.
- **Excel:** `players.service.ts:170-172` carga `file.buffer` sin `fileFilter` ni `limits`.
- **XFF/proxy:** `main.ts:14` `trust proxy=1`; cadena Caddy→nginx→backend; `mercadopago-webhook.controller.ts:101-108` usa el primer valor de `x-forwarded-for`.
- **WhatsApp:** `webhook.controller.ts` no valida `X-Hub-Signature-256` y **no consulta `enableNotificationsModule`**; `whatsappAppSecret` solo se persiste/muestra.

---

## B. Tabla de hallazgos (v2)

Severidad: **C** crítica, **A** alta, **M** media, **B** baja. Estado: **OK** confirmado, **POT** potencial, **RES** resuelto/descartado, **N/A** no aplica.

| ID | Sev | Estado | Archivo / ubicación | Evidencia | Explotación | Impacto | Corrección | Verificación |
|----|-----|--------|---------------------|-----------|-------------|---------|------------|--------------|
| SEC-01 | B (antes C) | OK | historial Git: `git log --all -- .env`; commits `bdc03d3`, `2a2ec35`; remoto `github.com:hectororviz/m-posw.git` | El `.env` histórico contenía `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD/PIN`, `CAJA01_PASSWORD`, `MP_ACCESS_TOKEN` (`APP_USR-`), `MP_WEBHOOK_SECRET*`. **Ya rotadas** | Un clon/fork del repo podría usar valores **viejos** (si algún servicio aún los aceptara) | Reducido: solo exposición histórica; no re-rotar | **No** volver a rotar. Purgar historial (`git filter-repo --path .env --invert-paths`) y push coordinado (avisar a forks/clones); bloquear `.env*` con gitleaks en CI | `trufflehog git file://.` limpio; confirmar en MP que los tokens viejos quedaron revocados |
| SEC-02 | — | N/A | `users.controller.ts:11-12`; `users.service.ts:16-63,120-145,189-209`; `user-permissions.service.ts:40-79`; `pos-device.service.ts:94-98` | Solo un actor con `CONFIGURACION=FULL` (admin-equivalente) escribe permisos; `create` fuerza `role:'USER'`; ADMIN no editable; no hay autoservicio | Ninguna escalada desde un nivel inferior: para tocar permisos se requiere ya ser admin-equivalente | **Falso positivo** con el modelo declarado | (Opcional, defensa en profundidad) separar "Configuración" de "Administración de usuarios", o exigir `role=ADMIN` real para crear usuarios/asignar `CONFIGURACION`; impedir que un admin-equivalente se otorgue módulos si eso no fuese intencional | Test: usuario sin `CONFIGURACION` → 403 en `/users`; admin-equivalente no puede tocar ADMIN |
| SEC-03 | A (temporal) | OK | `webhook.controller.ts:34-66`; `schema.prisma:329`; `settings.service.ts:107,226` | POST `/webhooks/whatsapp` sin `X-Hub-Signature-256`; `appSecret` no usado; no respeta `enableNotificationsModule` | POST anónimo con `entry[]` falso inyecta mensajes/estados y marca jobs `SENT` | Ensuciar conversaciones/historial y falsos "entregado" mientras siga activo | **Mínimo urgente:** validar HMAC SHA-256 con `whatsappAppSecret` fail-closed y cortar el POST si el módulo está desactivado (ver G). **Retiro:** ver sección H | Test firma válida/ inválida; POST sin header → 401/403; con módulo off → 403/404 |
| SEC-04 | M | OK | `sales.gateway.ts:11-15,22-32`; `SocketProvider.tsx:22-29` | `cors.origin='*'`; handshake envía token pero el servidor lo ignora; `sale.join` sin autorización | Cliente socket.io se une a `sale:<uuid>` ajeno y escucha `sale.payment_status_changed` | Fuga de estado de pago/metadatos de ventas | Validar JWT + sesión en el handshake; en `handleJoin` aplicar la misma regla que `assertCanAccessSale`; CORS ws = `CORS_ORIGIN` | Test e2e: sin token o venta ajena → sin eventos |
| SEC-05 | B | OK | `socios-qr.controller.ts:9-15`; `socios-qr.service.ts:93-102` | `GET /socios/qr/:uuid` público devuelve nombre, `nroSocio`, tipo, estado y beneficios | Con un UUID filtrado, cualquiera consulta datos del socio | Divulgación de PII/beneficios | Añadir `JwtAuthGuard` (único consumidor es el front autenticado) o aceptar device token; rate-limit | Test: GET sin token → 401 |
| SEC-06 | M | OK | `schema.prisma:320-343`; `ls -l .env*` = 664 | Tokens MP/WhatsApp y verify token en claro en `Setting`; `.env` y backups `.env.bak-*` legibles por grupo/otros | Volcado de DB o lectura del host expone tokens vivos | Robo de tokens de pago/mensajería | `chmod 600 .env*`; borrar `.env.bak-*` del host; cifrar secretos en reposo (secret manager o KMS) | `chmod 600 .env*`; test que `Setting` no serialice tokens |
| SEC-07 | B | OK | `mercadopago-oauth.service.ts:76-100,102-136` | `state: subdomain` estático; `exchangeToken(code)` no recibe/valida `state` | Login-CSRF de OAuth (requiere que un admin-equivalente autenticado siga un enlace) | Vinculación de cuenta MP ajena | `state` aleatorio por sesión, persistido y validado en el callback/token | Test: `state` inválido → rechazado |
| SEC-08 | B | OK | `frontend/nginx.conf`; `api/client.ts:11-16`; `AuthContext.tsx:47-49` | SPA sin CSP/X-Frame-Options/nosniff/HSTS; JWT en `localStorage` | XSS exfiltra token; clickjacking del panel | Robo de sesión | Headers en nginx (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`); evaluar cookies `HttpOnly`+CSRF | `curl -I` del front; CSP report-only primero |
| SEC-09 | B | OK | `players.controller.ts:78-83`; `players.service.ts:170-172` | `FileInterceptor` sin `fileFilter`/`limits`; `workbook.xlsx.load(file.buffer)` | Subida de xlsx grande/crafted (zip-bomb) hasta el tope de nginx (12 MB) | DoS/consumo de memoria del worker | `limits:{fileSize}` + `fileFilter` para `.xlsx`; validar extensión/MIME antes de parsear | Test upload sobredimensionado → 413/400 |
| SEC-10 | B | OK | `notificaciones.controller.ts:85-88` | `getUnreadCount` sin `@RequireModule` (solo JWT) | Usuario sin NOTIFICACIONES consulta un contador | Exposición mínima | Añadir `@RequireModule(NOTIFICACIONES, READ)` (o dejar si es intencional el badge) | Test de permisos |
| SEC-11 | B | OK | `dispositivos.controller.ts:33,42`; `acreedores.controller.ts:43,89`; `notificaciones.controller.ts:63,134-137` | Bodies inline o `@Body('campo')` sin DTO (whitelist no aplica) | Campos extra no se filtran | Bajo hoy; frágil ante cambios | Crear DTOs con class-validator | Body con campo extra → 400 |
| SEC-12 | B | OK | `settings.controller.ts:140-144`; `api/queries.ts:66-88` | GET `/settings` solo con JWT; devuelve config/flags a cualquier autenticado | Reconocimiento de configuración | Bajo | Devolver un subconjunto público a no-`CONFIGURACION` y mantener el resto tras el módulo (evitar romper POS/Checkout que ya usan `useSettings`) | Test: usuario sin CONFIGURACION recibe solo campos públicos |
| SEC-13 | B | POT | `pos-device.controller.ts:130-149`; `sales.service.ts:494-506` | Todas las terminales comparten `pos-terminal`; `getSaleById/cancel` se autorizan por `userId`, no por `deviceId` | Terminal comprometida accede/cancela ventas de otra terminal | Fuga/alteración entre cajas | Autorizar también por `deviceId` cuando el actor es device | Test: device A → venta de device B = 404 |
| SEC-14 | B | OK | `home.service.ts:210-217`; `mercadopago-oauth.service.ts:934-941` | `$queryRawUnsafe` (SQL constante / `$1`) | N/A hoy | Deuda técnica | Preferir `Prisma.sql`/`$queryRaw` tipado | Lint/revisión |
| SEC-15 | B | POT | `AdminSettingsPage.tsx:414-431` | `marked.parse` sin sanitizar + `dangerouslySetInnerHTML` sobre `public/about.md` (estático) | Solo si `about.md` se vuelve contenido no confiable | Stored XSS latente | Sanitizar con DOMPurify | Test con `<img onerror>` en about.md |
| SEC-16 | B | OK | `package.json` (back/front); `.github/workflows/*.yml` | Deps recientes; Actions por tag (`@v4`,`@v5`), sin `npm audit`/SBOM/escaneo | Supply-chain si un tag se mueve; CVE no detectada | Bajo/medio | Fijar Actions por SHA; agregar `npm audit`/`osv-scanner` y escaneo de imagen en CI | Job CI que falle ante CVE alta |
| SEC-17 | M | OK/POT | `main.ts:14` (`trust proxy=1`); `app.module.ts:36` (60/min); `mercadopago-webhook.controller.ts:101-108` | Cadena Caddy→nginx→backend; login 5/min; el webhook conta intentos por el **primer** valor de `x-forwarded-for` | (a) El throttler puede agrupar a todos bajo la IP de Caddy o ser evadible; (b) el límite del webhook se evade rotando XFF | Rate limiting inefectivo / colisiones de cupo | Ajustar `trust proxy` al nº real de hops o usar IP de Caddy; en el webhook usar `req.ip`/última IP confiable, no el primer XFF | Test con XFF falsos → mismo cupo; login 6º → 429 |

---

## C. Matriz de los 20 puntos (v2)

| # | Área | Estado | Nota v2 |
|---|------|--------|---------|
| 1 | Gestión de API keys / env / secretos | **Parcial** | Secretos en `Setting` en claro y `.env*` 664 (SEC-06) |
| 2 | Secretos en Git (historial/ignorados) | **Parcial** | Rotados; historial persiste → limpieza coordinada (SEC-01) |
| 3 | Credenciales/privilegios PostgreSQL, puertos | **Implementado (parcial)** | `db` sin puertos publicados; sin usuario de mínimos privilegios/RLS |
| 4 | Aislamiento multi-tenant y RLS | **N/A / Parcial** | 1 instancia = 1 DB/club; sin RLS (aceptable en este modelo) |
| 5 | Cifrado en tránsito/reposo y datos sensibles | **Parcial** | TLS en Caddy; sin cifrado en reposo de tokens ni de la DB |
| 6 | Autenticación: rutas/guards/excepciones | **Parcial** | Sin guard global; endpoints públicos por diseño + SEC-03/05 |
| 7 | Autorización usuario/rol/módulo/registro (IDOR/BOLA) | **Implementado (parcial)** | `CONFIGURACION=FULL` = admin (SEC-02 N/A); ventas con `assertCanAccessSale`; SEC-05/13 |
| 8 | Mass assignment | **Mayormente OK** | Whitelist global; SEC-11 en bodies inline |
| 9 | Cookies/sesiones/JWT/refresh/CSRF | **Parcial** | Bearer en localStorage; JWT 4 h sin refresh; sesión única |
| 10 | Hashing de contraseñas / recuperación | **Implementado (parcial)** | bcrypt(10); recuperación solo por admin |
| 11 | Rate limiting / fuerza bruta | **Parcial** | SEC-17 (XFF/proxy) |
| 12 | Bots / automatización abusiva | **Parcial** | Sin captcha; SEC-17 |
| 13 | Inyección SQL / Prisma | **Implementado** | Parametrizado/constante |
| 14 | Validación de entradas / DTOs | **Parcial** | SEC-11 |
| 15 | XSS / sanitización | **Parcial** | React escapa; SEC-15 |
| 16 | Subida/descarga/acceso a archivos | **Parcial** | Imágenes OK; SEC-09; `/uploads` público (bloquea `whatsapp-media`) |
| 17 | Exposición de datos en respuestas/errores/logs | **Implementado (parcial)** | Sin `password` en selects; `Setting` no devuelve tokens; SEC-12 |
| 18 | Security headers / CORS | **Parcial** | Helmet backend; WS `*` (SEC-04); nginx sin headers (SEC-08) |
| 19 | HTTPS/certs/proxies/cookies seguras | **Parcial** | TLS en Caddy; `trust proxy` a revisar (SEC-17) |
| 20 | Dependencias / install scripts / imágenes / CI | **Parcial** | SEC-16 |

---

## D. Problemas adicionales fuera de la lista (v2)

- **WhatsApp sin gate por módulo:** el webhook procesa aunque `enableNotificationsModule=false` (`webhook.controller.ts` no lo consulta). Relevante para el retiro (sección H).
- **`forbidNonWhitelisted` + body inline:** patrón frágil en `dispositivos`/`acreedores`/`notificaciones` (SEC-11).
- **Sesión única como posible DoS:** cada login revoca todas las sesiones (`auth.service.ts:25-33`).
- **PII sin cifrado/retención:** DNI/teléfono de socios, jugadores y acreedores.
- **Atribución difusa de terminales:** `pos-terminal` compartido (relacionado con SEC-13).
- **Mensajes de error de negocio** revelan lógica interna (p. ej. descuento esperado vs recibido), útil para probing.
- **`/uploads` estático público:** bloquea solo `whatsapp-media`; conviene confirmar que no haya archivos sensibles persistidos por otros módulos.

---

## E. Plan de remediación actualizado (riesgo real × impacto funcional × esfuerzo)

Leyenda esfuerzo: **S** (≤1 día), **M** (2–5 días), **L** (>5 días).

### Fase 1 — Riesgo real inmediato (sin re-rotar credenciales)

| Orden | Hallazgo | Acción | Tipo | Impacto funcional | Esfuerzo |
|-------|----------|--------|------|-------------------|----------|
| 1 | SEC-01 | Purga de historial Git + push coordinado + gitleaks en CI. **No** re-rotar | Operación/CI | Ninguno | S |
| 2 | SEC-06 | `chmod 600 .env*`; borrar `.env.bak-*`; plan de cifrado/secret manager | Operación/Infra | Ninguno | S |
| 3 | SEC-04 | Autenticar handshake WS y autorizar `sale.join` por venta | Código | Ninguno (el front ya manda token) | M |
| 4 | SEC-03 | Fix mínimo de firma + gate por módulo; luego desmantelar (H) | Código | Ninguno (o positivo al retirar) | S |

### Fase 2 — Media/baja, impacto funcional acotado

| Orden | Hallazgo | Acción | Tipo | Impacto funcional | Esfuerzo |
|-------|----------|--------|------|-------------------|----------|
| 5 | SEC-17 | Ajustar `trust proxy` al nº de hops; webhook usa IP confiable; revisar límites | Código/Infra | Bajo (revisar cupos) | S–M |
| 6 | SEC-05 | JWT/device token en `/socios/qr/:uuid`; rate-limit | Código | Ninguno (front ya autenticado) | S |
| 7 | SEC-13 | Autorizar por `deviceId` en rutas POS | Código | Ninguno | S–M |
| 8 | SEC-08 | Headers de seguridad en nginx (+CSP); evaluar cookies | Código/Infra | Bajo (CSP puede requerir ajustes) | M |
| 9 | SEC-12 | Subconjunto público vs. módulo; sin romper POS/Checkout | Código | Bajo (requiere partir el DTO de respuesta) | M |
| 10 | SEC-09 | `limits` + `fileFilter` en import Excel | Código | Ninguno | S |
| 11 | SEC-07 | `state` OAuth aleatorio y validado | Código | Ninguno | S |
| 12 | SEC-11 | DTOs para bodies inline | Código | Ninguno | S |
| 13 | SEC-15 | Sanitizar `marked` con DOMPurify | Código | Ninguno | S |
| 14 | SEC-10 | `@RequireModule` en `getUnreadCount` (si no es intencional) | Código | Bajo (badge del header) | S |

### Fase 3 — Infra/DB/CI/Ops

| Orden | Hallazgo | Acción | Tipo | Impacto | Esfuerzo |
|-------|----------|--------|------|---------|----------|
| 15 | SEC-16 | Actions por SHA; `npm audit`/`osv-scanner` + escaneo de imagen en CI | CI | Ninguno | S–M |
| 16 | SEC-06 | Usuario Postgres de mínimos privilegios; `ssl` en `DATABASE_URL`; backups cifrados | DB/Infra | Requiere ventana | M |
| 17 | SEC-14 | Migrar `$queryRawUnsafe` a `Prisma.sql`/`$queryRaw` | Código | Ninguno | S |
| 18 | SEC-02 (defensa en profundidad) | Separar Configuración de Administración de usuarios o exigir ADMIN real | Código/Diseño | Bajo | M |

### Orden de ejecución sugerido
`SEC-01/06 (ops) → SEC-04 → SEC-03 → SEC-17 → SEC-05 → SEC-13 → SEC-08 → SEC-12 → SEC-07/09/10/11/15 → SEC-16/14 → SEC-02 (opcional)`.

---

## F. Pruebas automatizadas a añadir (v2)

Backend (Jest):
- **Usuarios/permisos (SEC-02):** usuario sin `CONFIGURACION` → 403 en `/users`; admin-equivalente no puede modificar al ADMIN ni setear `role`.
- **WebSocket (SEC-04):** handshake sin token/sesión revocada → rechazado; `sale.join` de venta ajena → sin eventos.
- **WhatsApp (SEC-03):** POST sin firma → 401/403; firma HMAC inválida → rechazada; firma válida → 200; con `enableNotificationsModule=false` → rechazado.
- **QR socios (SEC-05):** GET sin token → 401.
- **POS/SEC-13:** device A no accede a venta de device B.
- **Settings (SEC-12):** usuario sin `CONFIGURACION` recibe solo el subconjunto público.
- **Excel (SEC-09):** archivo sobredimensionado/MIME inválido → 4xx.
- **Rate limiting (SEC-17):** login 6º → 429; XFF falsos no multiplican cupo.
- **Contratos públicos:** test que fije explícitamente rutas públicas vs. protegidas.

Frontend/CI:
- Sanitización de `about.md` (DOMPurify).
- Job `gitleaks`/`trufflehog` sobre el diff; `npm audit`/`osv-scanner` con umbral.

---

## G. SEC-03 — Corrección mínima urgente (mientras WhatsApp siga activo)

Dado que el retiro es inminente, la corrección debe ser **pequeña y contenida**, no un rediseño:

1. En `webhook.controller.ts` POST: calcular HMAC SHA-256 sobre el *raw body* con `whatsappAppSecret` y comparar con `X-Hub-Signature-256` (comparación *timing-safe*); **rechazar** si falta o no coincide.
2. Si `whatsappAppSecret` no está configurado, **fail-closed** (rechazar) en producción.
3. Cortar el procesamiento si `enableNotificationsModule=false` (hoy no lo verifica).
4. Requiere habilitar el body crudo en el webhook (`rawBody` en Nest) o reconstruir el payload exacto; es un cambio localizado.

Alternativa aceptable si el corte de WhatsApp es inminente: **deshabilitar el POST público** (retornar 410/403) y dejar el GET de verificación, con lo que desaparece la superficie sin desarrollo adicional.

---

## H. SEC-03 — Plan de retiro seguro de WhatsApp

**Dependencias funcionales detectadas**
- Salida (no necesita webhook): `NotificacionesService.processQueue` → `WhatsAppCloudProvider.sendMessage/sendTextMessage`; disparado por `acreedores.service.ts:561,601` (`notificarDeuda`, `notificarDeudaBatch`) y UI de notificaciones.
- Entrada (sí depende del webhook): recepción de mensajes (`WhatsAppConversation`/`WhatsAppMessage`), estados `delivered/read` (`NotificationJob`), y descarga de media (`whatsapp-media.service.ts`).
- Config/UI: `AdminNotificacionesPage` (config, historial, cola, conversaciones, media, plantilla), badge `AppHeader` (`unread-count`), y campos `whatsapp*` en `Setting` y `.env.example`.

**Pasos de retiro (ordenados)**
1. **Anuncio/corte funcional:** desactivar `enableNotificationsModule` (oculta UI y debe bloquear el webhook tras el punto G.3); confirmar que no haya jobs en cola o drenarlos.
2. **Cerrar la entrada:** eliminar/deshabilitar la ruta `POST /webhooks/whatsapp` y el `GET` de verificación; retirar el endpoint público de la documentación.
3. **Revocar credenciales en Meta:** deshabilitar el webhook de la app, revocar `whatsappAccessToken`/`whatsappAppSecret`, eliminar el verify token.
4. **Limpiar secretos:** borrar de `Setting` (`whatsappAccessToken`, `whatsappAppSecret`, `whatsappWebhookVerifyToken`, `whatsappPhoneNumberId`) y del `.env`; quitar las variables comentadas de `.env.example`.
5. **Datos:** exportar y luego eliminar `WhatsAppConversation`/`WhatsAppMessage` y los archivos en `uploads/whatsapp-media/*` conforme a la política de retención (incluye PII de terceros).
6. **Código:** retirar el módulo `notificaciones` y sus imports (sin reescrituras): controller, provider, media service, DTOs, y la integración en `acreedores.service.ts`; quitar el badge del header.
7. **Verificación:** `grep -ri whatsapp backend/src frontend/src` sin referencias activas; endpoint responde 404/410; no quedan tokens en `Setting`.

> Nota: la salida vía Graph API deja de funcionar igual al cambiar las condiciones comerciales; el valor real del retiro es **eliminar la superficie de entrada no autenticada** y **borrar credenciales/datos**.

---

## I. Limitaciones de esta revisión

- **Sin infraestructura en ejecución:** no se pudo confirmar el comportamiento efectivo de `trust proxy`/throttler bajo la cadena Caddy→nginx→backend, ni headers/TLS reales, ni privilegios de DB.
- **Sin pruebas dinámicas** (pentesting/fuzzing) ni contacto con MercadoPago/Meta; SEC-07 y SEC-17 quedan como *potenciales* hasta validación en entorno.
- **Dependencias:** análisis por `package.json`; no se corrió `npm audit`/osv (sin red).
- **Cobertura Android:** no se auditó la APK Kotlin/Flutter.
- **Modelo de autorización:** SEC-02 se evaluó con la premisa declarada `CONFIGURACION=FULL ≡ ADMIN`; si esa equivalencia cambiara, el hallazgo volvería a ser aplicable.

Fin de la revisión v2. No se aplicaron correcciones. Pendiente de tu aprobación para ejecutar el plan (sección E) y las acciones de retiro (sección H).

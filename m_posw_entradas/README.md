# m-posw Terminal — APK único Entradas + POS bufet (Sunmi V2s, Kotlin)

App nativa Android (XML Views + Fragments, sin WebView ni híbridos).
Consume `https://CLIENTE.mposw.com.ar/api/...` con Retrofit e imprime en la
impresora integrada del Sunmi V2s con el SDK oficial (`com.sunmi:printerlibrary`).

Contrato válido: `docs/contrato-pos-entradas.txt` del repo principal.

Un solo módulo, paquetes `ui/entradas/` y `ui/pos/` que no se importan
entre sí (verificado en CI con grep). Solo comparten código común:
red (`data/`), sesión, impresión Sunmi (`printer/`), escáner y pairing.

## Vinculación
1. En la web: Sistema → Dispositivos → "+" (nombre + tipo) → el mismo
   modal muestra token `ent_…` (una sola vez) + QR pairing `{"baseUrl","token"}`
   y la sección para vincular su POS de Mercado Pago propio.
2. En la app: Config → Escanear QR (o pegar `baseUrl` + `token` manual) → Probar conexión.
3. El token se guarda en `EncryptedSharedPreferences`, nunca se loguea ni imprime.
4. `401 DEVICE_REVOKED` → se borra el token y pide re-pairing.
5. El modo (ENTRADAS/POS) lo define el servidor (`GET /entradas/devices/me`,
   consultado en cada arranque, al volver a primer plano, cada 60s visible
   y ante cualquier `403 DEVICE_WRONG_MODE`; offline usa el último conocido).
   El QR nunca lleva el modo. Sin modo validado la app queda en Configuración.
6. Cada terminal necesita su POS de MP propio para QR (sin fallback:
   evita colisiones en MP). CASH opera sin vincular.

## Modo Entradas
- Venta: elige partido (spinner solo si hay >1), sector con nombres de clubes (LOCAL = `clubName`, VISITANTE = rival del fixture), cantidad 1–10 con +/−, opcional Botón Socio (escanea credencial → `GET socios/:uuid`, exige `AL_DIA`; la ✕ para quitarlo aparece solo con socio aplicado). Debajo del cobro hay contador de vendidas por sector; Reimprimir queda último. Al aprobarse (CASH o QR) se muestra un diálogo de éxito con animación nativa + códigos y total.
- Efectivo: `POST intent CASH` → `APPROVED` → imprime N tickets (`L-001`/`V-001`).
- QR: `POST intent MP_QR` → muestra la imagen **estática** del POS propio del
  device → polling `GET status` cada 2.5s hasta 5 min → al `APPROVED` imprime. Cancelar libera la orden.
- Template + escudo se descargan al probar conexión y cuando `templateVersion/logoVersion` cambian (nunca por venta). Ancho fijo 32 cols, 58mm.
- Sin papel: la venta queda en Room (`entradas.db` → `approved_sales`) y se reimprime con “Reimprimir última”.
- Branding: el header muestra solo el escudo a 128dp centrado + fecha arriba a la
  derecha (sin nombre ni fondo de color); los botones de cobro se tiñen con
  `Setting.accentColor`. Todo llega en `GET /entradas/ticket-assets/escudo`
  (cacheado por versión) al pulsar “Probar conexión” o en cada venta; sin color
  válido queda el tema genérico. La navegación a Config es un engranaje fijo
  abajo a la derecha (Config tiene botón Volver).
  Tema Material 3 propio en claro y oscuro.

## Modo POS (bufet)
- Dash con tabs por categoría (swipe lateral) + grilla de productos con foto
  (Coil, cache disco/memoria; fallback color+emoji; sin foto no frena nada).
  Total abajo con contador ("$1.500 · 3 productos"), botón `$` (color de
  resaltado) y engranaje a Config.
- Carrito slide-up: franja de arrastre (swipe o tap) o tap en el total.
  Líneas con +/−/eliminar, filas de descuento, total y “Reimprimir última”.
- Un único flujo de pago: total arriba, **Efectivo** (cobro exacto ya realizado:
  registra e imprime), **QR** (genera directo + polling 2s/120s) y **Fiado**,
  solo los habilitados en Setting (Transferencia no existe en terminales).
  Debajo, **Escanear descuento**: UUID socio (exige `AL_DIA`, descuentos
  calculados como la web) o `ENT:código` (% sobre destino con tope, se consume
  al aprobar). Misma animación de éxito que Entradas.
- Fiado: lista de acreedores activos con deuda e icono de estado (⛔ límite
  bloquea, ⚠️ advertencia exige segundo tap); mismas reglas que la web
  (límite validado también en servidor).
- Ticket bufet en Sunmi: club/tienda/fecha, items con nº de orden, total,
  vuelto, PINs de vouchers, gracias + no-fiscal. Catálogo cacheado en
  `pos.db` (ventas siempre online); aprobadas guardadas para reimpresión.
- Sin pinch-to-zoom: tamaño S/M/L en Config (texto + alto de foto + columnas).
- Ventas atribuidas al usuario genérico `pos-terminal` (seed). `Sale.deviceId`
  identifica la terminal.
- RAM (Sunmi 1 GB): nada del modo inactivo se inicializa; `entradas.db` no se
  abre en POS ni `pos.db` en Entradas.

## Config
- Vinculación (baseUrl + token), Probar conexión, sello de versión
  (`vX.Y.Z (sha)` para confirmar qué build corre el equipo), tamaño S/M/L,
  tema claro/oscuro/sistema.

## Build
Requiere **Java 17** (Gradle 8.7 no corre en Java 26 ni en Java 8) y Android SDK con
plataforma 34. El wrapper (`gradlew` + `gradle/wrapper/gradle-wrapper.jar`) viene
commiteado: no hace falta instalar Gradle.
```bash
cd m_posw_entradas
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk   # o donde esté tu JDK 17
export ANDROID_HOME=/opt/android-sdk            # o creá local.properties con sdk.dir=
./gradlew :app:assembleDebug
# o desde Android Studio: Open → m_posw_entradas
```
El APK sale en `app/build/outputs/apk/debug/`. Release con minify +
shrink + split por ABI (`armeabi-v7a`, `arm64-v8a` + universal instalable).
Probado en Sunmi V2s (Android 11, minSdk 25). La impresión usa la API AIDL
`com.sunmi.peripheral.printer.*` del `printerlibrary:1.0.15` (ese AAR no trae
`SunmiPrintHelper`; no intentar usarlo).
CI (`.github/workflows/build-apk.yml`): un workflow, un tag (`terminal-latest`),
verifica separación de paquetes, compila release (mide tamaño) y publica el
debug universal. No compila Docker (paths-ignore en `docker-publish.yml`).

## Checklist primera prueba
- [ ] GET vigentes con token responde por HTTPS
- [ ] Pairing QR guarda token
- [ ] CASH 1x LOCAL imprime L-001 con escudo
- [ ] MP_QR muestra imagen del POS propio, pago con teléfono, poll aprueba e imprime
- [ ] Cancel libera PENDING; EXPIRED a los ~10 min sin pago
- [ ] Cambio ENTRADAS↔POS en el front cambia la pantalla sola (≤60s o al actuar)
- [ ] POS: catálogo con fotos, CASH/QR/Fiado según Setting, socio + `ENT:`, ticket bufet
- [ ] Fiado: LÍMITE bloquea, ADVERTENCIA pide segundo tap

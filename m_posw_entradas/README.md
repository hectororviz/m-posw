# m-posw Terminal — APK única Entradas + POS bufet (Kotlin)

App nativa Android (XML Views + Fragments, sin WebView ni híbridos).
Corre en **cualquier equipo Android** (teléfonos, tablets) y en el
Sunmi V2s: el backend de impresión se elige solo en runtime.
Consume `https://CLIENTE.mposw.com.ar/api/...` con Retrofit.

Contrato válido: sección Entradas/POS de `AGENTS.md` en el repo principal.

Un solo módulo, paquetes `ui/entradas/` y `ui/pos/` que no se importan
entre sí (verificado en CI con grep). Solo comparten código común:
red (`data/`), sesión, impresión (`printer/`), escáner y pairing.

## Vinculación
1. En la web: Sistema → Dispositivos → "+" (nombre + tipo) → el mismo
   modal muestra token `ent_…` (una sola vez) + QR pairing `{"baseUrl","token"}`
   y la sección para vincular su POS de Mercado Pago propio.
2. En la app: Config → Conexión → Escanear QR (o pegar `baseUrl` + `token`
   manual) → Estado → Probar conexión.
3. El token se guarda en `EncryptedSharedPreferences`, nunca se loguea ni imprime.
4. `401 DEVICE_REVOKED` → se borra el token y pide re-pairing.
5. El modo (ENTRADAS/POS) lo define el servidor (`GET /entradas/devices/me`,
   consultado en cada arranque, al volver a primer plano, cada 60s visible
   y ante cualquier `403 DEVICE_WRONG_MODE`; offline usa el último conocido).
   El QR nunca lleva el modo. Sin modo validado la app queda en Configuración.
6. Cada terminal necesita su POS de MP propio para QR (sin fallback:
   evita colisiones en MP). CASH opera sin vincular.

## Impresión (automática, sin ajustes de tipo de equipo)
- `PrinterRouter` elige el backend solo: si el equipo trae el servicio de
  impresión Sunmi usa el AIDL integrado; si no, la impresora Bluetooth
  configurada en Config → Impresora (58mm ESC/POS por SPP, mismo diseño
  de ticket que Sunmi: 32 columnas, QR, escudo, corte).
- Bluetooth: pide `BLUETOOTH_CONNECT` en Android 12+, lista emparejadas,
  conecta-imprime-cierra por venta (sin socket persistente), prueba de
  impresión y atajo a ajustes del sistema para emparejar.
- Sin impresora (o apagada/sin papel): la venta igual se aprueba y queda
  guardada en Room para reimprimir. En POS no hay botón "Reimprimir
  última" (sí el reintento del diálogo post-cobro y el de Entradas).

## Modo Entradas
- Venta: elige partido (spinner solo si hay >1), sector con nombres de clubes (LOCAL = `clubName`, VISITANTE = rival del fixture), cantidad 1–10 con +/−, opcional Botón Socio (escanea credencial → `GET socios/:uuid`, exige `AL_DIA`; la ✕ para quitarlo aparece solo con socio aplicado). Debajo del cobro hay contador de vendidas por sector; Reimprimir queda último. Al aprobarse (CASH o QR) se muestra un diálogo de éxito con animación nativa + códigos y total.
- **Últimas ventas**: solo las del día (hora del equipo); la tabla local se poda a 7 días.
- Efectivo: `POST intent CASH` → `APPROVED` → imprime N tickets (`L-001`/`V-001`).
- QR: `POST intent MP_QR` → muestra la imagen **estática** del POS propio del
  device → polling `GET status` cada 2.5s hasta 5 min → al `APPROVED` imprime. Cancelar libera la orden.
- Template + escudo se descargan al probar conexión y cuando `templateVersion/logoVersion` cambian (nunca por venta). Ancho fijo 32 cols, 58mm.
- Sin papel: la venta queda en Room (`entradas.db` → `approved_sales`) y se reimprime con “Reimprimir última”.
- Branding: el header muestra solo el escudo a 128dp centrado + fecha arriba a la
  derecha (sin nombre ni fondo de color); los botones de cobro se tiñen con
  `Setting.accentColor`. Todo llega en `GET /entradas/ticket-assets/escudo`
  (cacheado por versión) al pulsar “Probar conexión” o en cada venta; sin color
  válido queda el tema genérico.
- Tema Material 3 propio en claro y oscuro.

## Modo POS (bufet)
- Dash con tabs por categoría (swipe lateral) + grilla de productos con foto.
  **Tamaño fijo por escala S/M/L** (tarjeta 140/180/220dp, foto cuadrada):
  abrir/cerrar el lateral o rotar solo cambia la **cantidad** por fila,
  nunca el tamaño. El span sale de métricas de ventana (sin medir vistas).
- **Fotos con caché propia** (`ProductImageStore`, `filesDir/product_images`):
  cada foto es `<productId>_<imageUpdatedAt>.webp`; si coincide se muestra
  sin red, si cambió se descarga (4 en paralelo) y se limpian obsoletas.
  Sin red se ven las ya guardadas. Apertura instantánea con snapshot de
  `pos.db` + refresh de fondo. Estado muestra `fotos local/total · MB`.
- **Tablet apaisada** (`sw600dp-land`): carrito lateral fijo de 360dp
  colapsable (como la web: líneas, descuentos, TOTAL, Cobrar), con engranaje
  a Config en el header. En teléfono/vertical sigue el slide-up con el mismo
  panel compartido (`PosCartPanelFragment`).
- Un único flujo de pago: total arriba, **Efectivo** (cobro exacto ya realizado:
  registra e imprime), **QR** (genera directo + polling 2s/120s) y **Fiado**,
  solo los habilitados en Setting (Transferencia no existe en terminales).
  Debajo, **Escanear descuento**: UUID socio (exige `AL_DIA`, descuentos
  calculados como la web) o `ENT:código` (% sobre destino con tope, se consume
  al aprobar). Misma animación de éxito que Entradas.
- Fiado: lista de acreedores activos con deuda e icono de estado (⛔ límite
  bloquea, ⚠️ advertencia exige segundo tap); mismas reglas que la web
  (límite validado también en servidor).
- Ticket bufet: club/tienda/fecha, items con nº de orden, total,
  vuelto, PINs de vouchers, gracias + no-fiscal. Catálogo cacheado en
  `pos.db` (ventas siempre online); aprobadas guardadas para reimpresión.
- Sin pinch-to-zoom: tamaño S/M/L en Config → Apariencia.
- Ventas atribuidas al usuario genérico `pos-terminal` (seed). `Sale.deviceId`
  identifica la terminal.
- RAM (Sunmi 1 GB): nada del modo inactivo se inicializa; `entradas.db` no se
  abre en POS ni `pos.db` en Entradas. Fotos en RGB_565 (sin alfa).

## Config (por pestañas)
- **Estado**: modo, servidor, impresora, sello de versión
  (`vX.Y.Z (sha)` para confirmar qué build corre el equipo), fotos
  `local/total · MB` y Probar conexión.
- **Conexión**: baseUrl + token + Escanear QR + Guardar.
- **Impresora**: estado, Elegir (emparejadas), Olvidar, Imprimir prueba,
  Ajustes Bluetooth. En Sunmi informa la integrada y esconde lo de BT.
- **Apariencia**: tamaño S/M/L, tema claro/oscuro/sistema, modo prueba
  (ventas ficticias con impresión real, QR y socio deshabilitados).

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
Probado en Sunmi V2s (Android 11, minSdk 25), teléfonos y tablets con
impresora BT 58mm. La impresión Sunmi usa la API AIDL
`com.sunmi.peripheral.printer.*` del `printerlibrary:1.0.15` (ese AAR no trae
`SunmiPrintHelper`; no intentar usarlo).
CI (`.github/workflows/build-apk.yml`): corre en push a main que toque
`m_posw_entradas/` y manual (`workflow_dispatch`, en branches solo verifica:
`terminal-latest` se publica únicamente desde main). Verifica separación de
paquetes, compila release (mide tamaño) y publica el debug universal en el
tag `terminal-latest`. No compila Docker (paths-ignore en `docker-publish.yml`).

## Checklist primera prueba
- [ ] GET vigentes con token responde por HTTPS
- [ ] Pairing QR guarda token
- [ ] CASH 1x LOCAL imprime L-001 con escudo
- [ ] MP_QR muestra imagen del POS propio, pago con teléfono, poll aprueba e imprime
- [ ] Cancel libera PENDING; EXPIRED a los ~10 min sin pago
- [ ] Cambio ENTRADAS↔POS en el front cambia la pantalla sola (≤60s o al actuar)
- [ ] POS: catálogo con fotos, CASH/QR/Fiado según Setting, socio + `ENT:`, ticket bufet
- [ ] Fiado: LÍMITE bloquea, ADVERTENCIA pide segundo tap
- [ ] BT: Elegir emparejada + Imprimir prueba OK; sin impresora la venta aprueba igual y queda para reimprimir
- [ ] Tablet apaisada: lateral con Cobrar, colapso, grilla con mismo tamaño abierto/cerrado
- [ ] Sin red: se ven fotos ya descargadas; Estado muestra `fotos local/total`

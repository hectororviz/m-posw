# m-posw Entradas — POS nativo Sunmi V2s (Kotlin)

App nativa Android (XML Views + Fragments, sin WebView ni híbridos) para venta de entradas.
Consume `https://CLIENTE.mposw.com.ar/api/entradas/...` con Retrofit e imprime en la
impresora integrada del Sunmi V2s con el SDK oficial (`com.sunmi:printerlibrary`).

Contrato válido: `docs/contrato-pos-entradas.txt` del repo principal.
`requerimientos_api.txt` de esta carpeta es la propuesta original (histórica).

## Vinculación
1. En la web: Entradas → Dispositivos → generar device (token `ent_…` + QR pairing `{"baseUrl","token"}`).
2. En la app: Config → Escanear QR (o pegar `baseUrl` + `token` manual) → Probar conexión.
3. El token se guarda en `EncryptedSharedPreferences`, nunca se loguea ni imprime.
4. `401 DEVICE_REVOKED` → se borra el token y pide re-pairing.

## Uso
- Venta: elige partido (spinner solo si hay >1), sector L/V, cantidad 1–10 con +/−, opcional Botón Socio (escanea credencial → `GET socios/:uuid`, exige `AL_DIA`; el descuento lo confirma el servidor en el intent).
- Efectivo: `POST intent CASH` → `APPROVED` → imprime N tickets (`L-001`/`V-001`).
- QR: `POST intent MP_QR` → muestra la imagen **estática** `qrImageUrl` del POS dedicado → polling `GET status` cada 2.5s hasta 5 min → al `APPROVED` imprime. Cancelar libera la orden.
- Template + escudo se descargan al probar conexión y cuando `templateVersion/logoVersion` cambian (nunca por venta). Ancho fijo 32 cols, 58mm.
- Sin papel: la venta queda en Room (`approved_sales`) y se reimprime con “Reimprimir última”.
- Branding: el header muestra escudo + nombre del club y tiñe el header y los
  botones de cobro con `Setting.accentColor`. Todo llega en
  `GET /entradas/ticket-assets/escudo` (cacheado por versión) al pulsar
  “Probar conexión” o en cada venta; sin color válido queda el tema genérico.
  Tema Material 3 propio en claro y oscuro.

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
El APK sale en `app/build/outputs/apk/debug/`. Probado en Sunmi V2s
(Android 11, minSdk 25). La impresión usa la API AIDL
`com.sunmi.peripheral.printer.*` del `printerlibrary:1.0.15` (ese AAR no trae
`SunmiPrintHelper`; no intentar usarlo).

## Checklist primera prueba
- [ ] GET vigentes con token responde por HTTPS
- [ ] Pairing QR guarda token
- [ ] CASH 1x LOCAL imprime L-001 con escudo
- [ ] MP_QR muestra imagen, pago con teléfono, poll aprueba e imprime
- [ ] Cancel libera PENDING; EXPIRED a los ~10 min sin pago

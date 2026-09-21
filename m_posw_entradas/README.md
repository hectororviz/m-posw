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

## Build
```bash
cd m_posw_entradas
./gradlew :app:assembleDebug
# o desde Android Studio: Open → m_posw_entradas
```
Requiere Android SDK 34, Kotlin 1.9.24. Probado en Sunmi V2s (minSdk 25).

## Checklist primera prueba
- [ ] GET vigentes con token responde por HTTPS
- [ ] Pairing QR guarda token
- [ ] CASH 1x LOCAL imprime L-001 con escudo
- [ ] MP_QR muestra imagen, pago con teléfono, poll aprueba e imprime
- [ ] Cancel libera PENDING; EXPIRED a los ~10 min sin pago

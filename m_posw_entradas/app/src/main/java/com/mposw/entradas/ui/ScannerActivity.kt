package com.mposw.entradas.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.journeyapps.barcodescanner.CaptureActivity

/**
 * Escáner QR con salida visible en modo quiosco.
 *
 * Extiende el CaptureActivity de zxing e infla el layout `zxing_capture`
 * propio de la app (override del de la librería), que agrega un botón
 * "Cancelar" — en quiosco no hay barra de sistema ni botón atrás.
 * Además cierra solo a los 90s sin lectura como red de seguridad.
 */
class ScannerActivity : CaptureActivity() {
    private val autoClose = Handler(Looper.getMainLooper())
    private val autoCloseTask = Runnable { if (!isFinishing) finish() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        findViewById<android.widget.Button>(
            com.mposw.entradas.R.id.btnCancelarScan,
        )?.setOnClickListener { finish() }
        autoClose.postDelayed(autoCloseTask, 90_000L)
    }

    override fun onDestroy() {
        autoClose.removeCallbacks(autoCloseTask)
        super.onDestroy()
    }
}

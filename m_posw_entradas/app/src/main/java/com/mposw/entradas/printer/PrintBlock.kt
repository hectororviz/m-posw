package com.mposw.entradas.printer

import android.graphics.Bitmap

/**
 * Bloques genéricos de ticket, independientes del backend de impresión
 * (Sunmi AIDL integrado vs ESC/POS por Bluetooth). align: 0 izq, 1 centro, 2 der.
 */
sealed interface PrintBlock {
    data class Text(
        val line: String,
        val size: Float = 24f,
        val bold: Boolean = false,
        val align: Int = 1,
    ) : PrintBlock

    data class Qr(val content: String) : PrintBlock

    data class Image(val bitmap: Bitmap) : PrintBlock

    data object Line : PrintBlock

    data object Feed : PrintBlock
}

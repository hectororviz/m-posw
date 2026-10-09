package com.mposw.entradas.ui

import android.graphics.Color
import androidx.core.graphics.ColorUtils

/**
 * Deriva los roles de color desde UN color semilla (Setting.accentColor del
 * tenant). Funciona en cualquier API (minSdk 25): DynamicColors con fuente
 * basada en contenido solo aplica en API 31+, por eso se deriva a mano.
 * Si la semilla es inválida o vacía, devuelve null y queda el tema base.
 */
object AccentTheme {
    data class Roles(
        val primary: Int,
        val onPrimary: Int,
        val primaryContainer: Int,
        val onPrimaryContainer: Int,
    )

    fun resolve(hex: String?, night: Boolean): Roles? {
        val (bg, on) = BrandApplier.parse(hex) ?: return null
        return if (night) {
            val container = ColorUtils.blendARGB(bg, Color.BLACK, 0.72f)
            Roles(bg, on, container, Color.WHITE)
        } else {
            val container = ColorUtils.blendARGB(bg, Color.WHITE, 0.82f)
            val lum = ColorUtils.calculateLuminance(container)
            val onContainer = if (lum < 0.5) darken(bg, 0.45f) else Color.parseColor("#0F172A")
            Roles(bg, on, container, onContainer)
        }
    }

    private fun darken(color: Int, ratio: Float): Int =
        ColorUtils.blendARGB(color, Color.BLACK, ratio.coerceIn(0f, 1f))
}

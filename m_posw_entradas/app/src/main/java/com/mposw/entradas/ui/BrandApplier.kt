package com.mposw.entradas.ui

import android.content.res.ColorStateList
import android.graphics.Color
import android.widget.Button
import android.widget.TextView
import com.google.android.material.card.MaterialCardView

/**
 * Aplica el color de personalización del servidor (Setting.accentColor,
 * recibido junto al escudo) al header y a las acciones de cobro.
 * Si el color es inválido o vacío, no toca nada y queda el tema base.
 */
object BrandApplier {
    fun parse(hex: String?): Pair<Int, Int>? {
        if (hex.isNullOrBlank()) return null
        return try {
            var h = hex.trim()
            if (!h.startsWith("#")) h = "#$h"
            if (h.length != 7) return null
            val bg = Color.parseColor(h)
            val lum = (0.299 * Color.red(bg) + 0.587 * Color.green(bg) + 0.114 * Color.blue(bg)) / 255
            val on = if (lum < 0.5) Color.WHITE else Color.parseColor("#0F172A")
            bg to on
        } catch (_: Exception) {
            null
        }
    }

    fun apply(
        hex: String?,
        header: MaterialCardView?,
        headerTexts: List<TextView>,
        cobroButtons: List<Button>,
    ) {
        val (bg, on) = parse(hex) ?: return
        header?.setCardBackgroundColor(bg)
        for (t in headerTexts) t.setTextColor(on)
        val bgList = ColorStateList.valueOf(bg)
        val onList = ColorStateList.valueOf(on)
        for (b in cobroButtons) {
            b.backgroundTintList = bgList
            b.setTextColor(onList)
            try {
                val m = b as? com.google.android.material.button.MaterialButton
                m?.iconTint = onList
            } catch (_: Exception) {
            }
        }
    }
}

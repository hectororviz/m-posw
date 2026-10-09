package com.mposw.entradas.util

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.floor
import kotlin.math.round

/**
 * Único formateador de montos de la app (es-AR): "$ 5.000" sin decimales,
 * y ",50" solo si el monto tiene centavos ("$ 5.000,50").
 */
object MoneyFormat {
    private val intFmt: NumberFormat = NumberFormat.getNumberInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }
    private val decFmt: NumberFormat = NumberFormat.getNumberInstance(Locale("es", "AR")).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }

    fun format(amount: Double): String {
        val rounded = round(amount * 100) / 100.0
        return if (rounded == floor(rounded)) {
            "$ ${intFmt.format(rounded)}"
        } else {
            "$ ${decFmt.format(rounded)}"
        }
    }

    fun format(amount: Number?): String = format(amount?.toDouble() ?: 0.0)

    /** Acepta strings del servidor ("1200.0", "1200") o ya formateados ("1.200,00"). */
    fun formatRaw(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        raw.toDoubleOrNull()?.let { return format(it) }
        return try {
            val parsed = NumberFormat.getNumberInstance(Locale("es", "AR")).parse(raw)?.toDouble()
            if (parsed == null) raw else format(parsed)
        } catch (_: Exception) {
            raw
        }
    }
}

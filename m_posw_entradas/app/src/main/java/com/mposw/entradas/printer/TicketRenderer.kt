package com.mposw.entradas.printer

import com.google.gson.Gson
import com.mposw.entradas.data.DatosTicket
import com.mposw.entradas.data.StatusPayload
import com.mposw.entradas.data.TemplateElement
import com.mposw.entradas.data.TemplateResponse

object TicketRenderer {
    private val gson = Gson()

    fun parseTemplate(json: String): List<TemplateElement> {
        if (json.isBlank()) return defaultElements()
        return try {
            val t = gson.fromJson(json, TemplateResponse::class.java)
            t.layout?.elements?.filter { it.enabled }?.takeIf { it.isNotEmpty() }
                ?: defaultElements()
        } catch (_: Exception) {
            defaultElements()
        }
    }

    fun defaultElements(): List<TemplateElement> = listOf(
        TemplateElement("logo", "{{escudo}}", null, "center", false, true),
        TemplateElement("text", "{{club}}", "L", "center", true, true),
        TemplateElement("text", "{{torneo}} vs {{rival}}", "M", "center", false, true),
        TemplateElement("text", "{{fecha}}  {{sector}}", "M", "center", false, true),
        TemplateElement("line", null, null, "center", false, true),
        TemplateElement("text", "{{codigo}}", "XL", "center", true, true),
        TemplateElement("qr", "{{codigo}}", null, "center", false, true),
        TemplateElement("text", "\${{precioUnit}} x{{cantidad}} = \${{total}}", "M", "center", false, true),
        TemplateElement("text", "{{footer}}", "S", "center", false, true),
        TemplateElement("qr", "{{benefitQr}}", null, "center", false, true),
        TemplateElement("text", "{{beneficioNombre}} {{beneficioPorcentaje}}", "M", "center", true, true),
    )

    fun varsFor(p: StatusPayload, codigo: String): Map<String, String> {
        val d: DatosTicket? = p.datos
        // Beneficio de bufet de ESTA unidad (por codigo). Sin beneficio → vars vacías
        // y los bloques se omiten solos (SunmiPrinter salta contenido en blanco).
        val b = (p.beneficios ?: emptyList()).firstOrNull { it.codigo == codigo }
        val pct = b?.porcentaje?.trim().orEmpty()
        // fecha: hora de pago (fechaPago/paidAt) en hora argentina con
        // formato "25/09/2026 - 20:18". Fallback: fecha del partido (solo fecha).
        val fechaHora = formatFechaPago(d?.fechaPago) ?: formatFechaPartido(d?.fecha).orEmpty()
        return mapOf(
            "club" to (d?.club ?: ""),
            "torneo" to (d?.torneo ?: ""),
            "rival" to (d?.rival ?: ""),
            "fecha" to fechaHora,
            "sector" to (d?.sector ?: ""),
            "codigo" to codigo,
            "codigos" to (p.codigos ?: emptyList()).joinToString(", "),
            "precioUnit" to (p.precioUnit ?: "0"),
            "cantidad" to p.cantidad.toString(),
            "total" to (p.total ?: "0"),
            "descuento" to (p.descuento ?: "0"),
            "ventaId" to (d?.ventaId ?: (p.saleId ?: "")),
            "fechaPago" to (formatFechaPago(d?.fechaPago) ?: ""),
            "footer" to (d?.footer ?: "Ticket no fiscal"),
            "escudo" to "{{escudo}}",
            "benefitQr" to (b?.qr ?: ""),
            "beneficioNombre" to (b?.beneficioNombre ?: ""),
            "beneficioPorcentaje" to (if (pct.isEmpty()) "" else "$pct%"),
        )
    }

    fun render(value: String?, vars: Map<String, String>): String {
        var s = value ?: ""
        for ((k, v) in vars) s = s.replace("{{$k}}", v)
        return s
    }

    private val tzArgentina: java.util.TimeZone
        get() = java.util.TimeZone.getTimeZone("America/Argentina/Buenos_Aires")

    /** "2026-09-25T23:18:00.000Z" → "25/09/2026 - 20:18" (hora argentina). */
    fun formatFechaPago(iso: String?): String? {
        if (iso.isNullOrBlank()) return null
        return try {
            val parser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
            parser.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val normalized = iso.trim().replace("Z", "").substringBefore("+")
            val base = normalized.substringBefore(".")
            val date = parser.parse(base) ?: return null
            val out = java.text.SimpleDateFormat("dd/MM/yyyy - HH:mm", java.util.Locale("es", "AR"))
            out.timeZone = tzArgentina
            out.format(date)
        } catch (_: Exception) {
            null
        }
    }

    /** "2026-09-25" o ISO de medianoche → "25/09/2026" (hora argentina). */
    fun formatFechaPartido(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        formatFechaPago(raw)?.let { return it.substringBefore(" - ") }
        return try {
            val parser = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            parser.timeZone = tzArgentina
            val date = parser.parse(raw.trim().take(10)) ?: return null
            val out = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale("es", "AR"))
            out.timeZone = tzArgentina
            out.format(date)
        } catch (_: Exception) {
            null
        }
    }
}

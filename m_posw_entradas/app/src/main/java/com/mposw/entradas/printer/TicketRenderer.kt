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
        return mapOf(
            "club" to (d?.club ?: ""),
            "torneo" to (d?.torneo ?: ""),
            "rival" to (d?.rival ?: ""),
            "fecha" to (d?.fecha ?: ""),
            "sector" to (d?.sector ?: ""),
            "codigo" to codigo,
            "codigos" to (p.codigos ?: emptyList()).joinToString(", "),
            "precioUnit" to (p.precioUnit ?: "0"),
            "cantidad" to p.cantidad.toString(),
            "total" to (p.total ?: "0"),
            "descuento" to (p.descuento ?: "0"),
            "ventaId" to (d?.ventaId ?: (p.saleId ?: "")),
            "fechaPago" to (d?.fechaPago ?: ""),
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
}

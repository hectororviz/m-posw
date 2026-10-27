package com.mposw.entradas.printer

import android.graphics.Bitmap
import com.mposw.entradas.data.StatusPayload
import com.mposw.entradas.data.TemplateElement

/**
 * Convierte los elementos del template de una entrada en [PrintBlock]s
 * genéricos (para el backend Bluetooth). Réplica exacta del loop por
 * ticket de `SunmiPrinter.printSale`: mismos tamaños, negritas y omisión
 * de contenido en blanco.
 */
object EntradasBlockBuilder {
    private fun textSize(size: String?): Float = when (size) {
        "XL" -> 48f
        "L" -> 36f
        "M" -> 28f
        else -> 24f
    }

    fun ticketBlocks(
        payload: StatusPayload,
        codigo: String,
        elements: List<TemplateElement>,
        escudo: Bitmap?,
    ): List<PrintBlock> {
        val out = mutableListOf<PrintBlock>()
        val vars = TicketRenderer.varsFor(payload, codigo)
        for (el in elements) {
            when (el.type) {
                "logo" -> escudo?.let { out.add(PrintBlock.Image(it)) }
                "text" -> {
                    val line = TicketRenderer.render(el.value, vars)
                    if (line.isNotBlank()) {
                        out.add(PrintBlock.Text(line, textSize(el.size), el.bold, 1))
                    }
                }
                "qr" -> {
                    val content = TicketRenderer.render(el.value, vars)
                    if (content.isNotBlank()) out.add(PrintBlock.Qr(content))
                }
                "line" -> out.add(PrintBlock.Line)
                "spacer" -> out.add(PrintBlock.Feed)
            }
        }
        return out
    }
}

package com.mposw.entradas.ui.pos

import android.content.Context
import com.mposw.entradas.data.PosSale
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.printer.SunmiPrinter
import com.mposw.entradas.printer.SunmiPrinter.PrintBlock
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Ticket de bufet en Sunmi. Clon exacto del ticket web de venta
 * (PrintTicketPage.tsx rama sale + ticketPrinting.ts):
 * club, tienda, fecha dd/MM/yy - HH:mm, Total antes de ítems con
 * 2 decimales, ítems filtrados por categoría.ticket y ordenados
 * bebidas-primero, nº de orden a la derecha, gracias, vouchers
 * (título + PIN por voucher) y pie no-fiscal. Sin Venta#, sin
 * efectivo/vuelto y sin escudo: la web no los imprime.
 */
object PosTicketRenderer {
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }

    suspend fun print(ctx: Context, sale: PosSale): Boolean {
        val session = SessionManager(ctx)
        val blocks = mutableListOf<PrintBlock>()

        // Filtro de categorías sin ticket (paridad con maybePrintTicket:
        // categoryTicket undefined/absent se asume true).
        val items = (sale.items ?: emptyList())
            .filter { it.product?.category?.ticket != false }
            .filter { !(it.product?.name ?: "").isBlank() }
            .sortedWith { a, b ->
                val aCat = a.product?.category?.name?.lowercase() ?: ""
                val bCat = b.product?.category?.name?.lowercase() ?: ""
                val aBeb = aCat == "bebida" || aCat == "bebidas"
                val bBeb = bCat == "bebida" || bCat == "bebidas"
                val aCom = aCat == "comida"
                val bCom = bCat == "comida"
                when {
                    aBeb && !bBeb -> -1
                    !aBeb && bBeb -> 1
                    aCom && !bCom -> 1
                    !aCom && bCom -> -1
                    else -> 0
                }
            }
        // Paridad con noTicketItems web: sin ítems imprimibles no se imprime.
        if (items.isEmpty()) return false

        val club = session.clubName.trim().ifBlank { null }
        if (club != null) blocks.add(PrintBlock.Text(club, 24f, false))
        val store = session.storeName.trim().ifBlank { "SOLER - Bufet" }
        blocks.add(PrintBlock.Text(store, 28f, true))

        val fecha = formatFecha(sale.paidAt ?: sale.createdAt)
        if (fecha != null) blocks.add(PrintBlock.Text(fecha, 24f, false))
        blocks.add(PrintBlock.Line)

        val total = sale.total?.toDoubleOrNull()
            ?: items.sumOf { it.subtotal?.toDoubleOrNull() ?: 0.0 }
        blocks.add(PrintBlock.Text("Total  ${money.format(total)}", 28f, true))

        for (item in items) {
            blocks.add(PrintBlock.Line)
            val name = (item.product?.name ?: "").uppercase()
            val size = if (name.length > 14) 24f else 28f
            blocks.add(PrintBlock.Text("${item.quantity}x $name", size, true))
            blocks.add(PrintBlock.Text(item.orderNumber.toString().padStart(3, '0'), 28f, true, 2))
        }
        blocks.add(PrintBlock.Line)

        blocks.add(PrintBlock.Text("Gracias por tu compra", 24f, false))

        val pins = (sale.vouchers ?: emptyList()).mapNotNull { it.pin?.trim()?.ifBlank { null } }
        if (pins.isNotEmpty()) {
            blocks.add(PrintBlock.Line)
            for (pin in pins) {
                blocks.add(PrintBlock.Text("INTERNET WIFI", 24f, false))
                blocks.add(PrintBlock.Text(pin, 28f, true))
            }
        }

        blocks.add(PrintBlock.Text("Ticket no fiscal", 24f, false))
        blocks.add(PrintBlock.Feed)

        return SunmiPrinter.printBlocks(ctx, null, blocks).isSuccess
    }

    /** ISO UTC → "dd/MM/yy - HH:mm" en hora local (igual que la web). */
    private fun formatFecha(iso: String?): String? {
        if (iso.isNullOrBlank()) return null
        val out = SimpleDateFormat("dd/MM/yy - HH:mm", Locale("es", "AR"))
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss",
        )
        for (p in patterns) {
            try {
                val d = SimpleDateFormat(p, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.parse(iso) ?: continue
                return out.format(d)
            } catch (_: Exception) {
            }
        }
        return null
    }
}

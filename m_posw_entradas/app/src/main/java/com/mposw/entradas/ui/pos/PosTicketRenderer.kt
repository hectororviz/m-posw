package com.mposw.entradas.ui.pos

import android.content.Context
import com.mposw.entradas.data.PosSale
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.printer.SunmiPrinter
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Ticket de bufet en Sunmi. Mismo contenido que TicketPayload web
 * (ticketPrinting.ts): club, tienda, fecha, items con nº de orden,
 * total, gracias, no-fiscal y PINs de vouchers.
 */
object PosTicketRenderer {
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    suspend fun print(ctx: Context, sale: PosSale): Boolean {
        val session = SessionManager(ctx)
        val blocks = mutableListOf<SunmiPrinter.PrintBlock>()
        val B = SunmiPrinter.PrintBlock

        val club = session.clubName.ifBlank { null }
        if (club != null) blocks.add(B.Text(club.uppercase(), 28f, true))
        val store = session.storeName.ifBlank { null }
        if (store != null) blocks.add(B.Text(store, 28f, true))
        blocks.add(B.Line)

        val fecha = formatFecha(sale.paidAt ?: sale.createdAt)
        if (fecha != null) blocks.add(B.Text(fecha, 24f, false))
        blocks.add(B.Text("Venta #${sale.orderNumber}", 24f, true))
        blocks.add(B.Line)

        for (item in sale.items) {
            val name = (item.product?.name ?: "").uppercase()
            blocks.add(B.Text("${item.quantity}x $name", 28f, true))
            val ord = item.orderNumber.toString().padStart(3, '0')
            blocks.add(B.Text(ord, 24f, false))
            blocks.add(B.Line)
        }

        val total = sale.total?.toDoubleOrNull() ?: 0.0
        blocks.add(B.Text("TOTAL: ${money.format(total)}", 36f, true))
        if (sale.paymentMethod == "CASH") {
            val rec = sale.cashReceived?.toDoubleOrNull()
            val vue = sale.changeAmount?.toDoubleOrNull()
            if (rec != null) blocks.add(B.Text("Efectivo: ${money.format(rec)}", 24f, false))
            if (vue != null && vue > 0) blocks.add(B.Text("Vuelto: ${money.format(vue)}", 24f, false))
        }
        blocks.add(B.Line)

        if (sale.vouchers.isNotEmpty()) {
            blocks.add(B.Text("INTERNET WIFI", 28f, true))
            for (v in sale.vouchers) {
                val pin = v.pin ?: continue
                if (pin.isNotBlank()) blocks.add(B.Text(pin, 36f, true))
            }
            blocks.add(B.Line)
        }

        blocks.add(B.Text("Gracias por tu compra", 24f, false))
        blocks.add(B.Text("Ticket no fiscal", 24f, false))
        blocks.add(B.Feed)

        val escudo = SunmiPrinter.escudoBitmap(session.escudoBase64)
        return SunmiPrinter.printBlocks(ctx, escudo, blocks).isSuccess
    }

    private fun formatFecha(iso: String?): String? {
        if (iso.isNullOrBlank()) return null
        val out = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("es", "AR"))
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
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.parse(iso) ?: continue
                return out.format(d)
            } catch (_: Exception) {
            }
        }
        return null
    }
}

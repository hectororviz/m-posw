package com.mposw.entradas.ui.config.acreedores

import android.content.Context
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.printer.PrintBlock
import com.mposw.entradas.printer.PrinterRouter
import com.mposw.entradas.util.MoneyFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Ticket de cuenta del acreedor: nombre, fecha y hora de impresión,
 * saldo y detalle de los últimos 20 movimientos (fecha, hora,
 * importe signado y saldo corrido). Mismo pipeline que el ticket
 * de venta (Sunmi integrada o BT 58mm vía PrinterRouter).
 */
object AcreedorTicketRenderer {

    suspend fun print(
        ctx: Context,
        nombre: String,
        movs: List<AcreedorDetalleDialog.MovUi>,
        saldoLinea: String,
    ): Boolean {
        val session = SessionManager(ctx)
        val blocks = mutableListOf<PrintBlock>()

        val club = session.clubName.trim().ifBlank { null }
        if (club != null) blocks.add(PrintBlock.Text(club, 24f, false))
        val store = session.storeName.trim().ifBlank { "SOLER - Bufet" }
        blocks.add(PrintBlock.Text(store, 28f, true))
        blocks.add(PrintBlock.Text("Detalle de cuenta", 24f, false))
        blocks.add(PrintBlock.Line)

        blocks.add(PrintBlock.Text(nombre.ifBlank { "Acreedor" }.uppercase(), 28f, true))
        val ahora = SimpleDateFormat("dd/MM/yyyy - HH:mm", Locale("es", "AR")).format(Date())
        blocks.add(PrintBlock.Text("Fecha: $ahora", 24f, false))
        if (saldoLinea.isNotBlank()) blocks.add(PrintBlock.Text(saldoLinea, 28f, true))
        blocks.add(PrintBlock.Line)

        // Últimos 20 en orden cronológico (el más reciente al final).
        val ultimos = movs.sortedBy { it.fechaIso }.takeLast(20)
        if (ultimos.isEmpty()) {
            blocks.add(PrintBlock.Text("Sin movimientos", 24f, false))
        }
        for (m in ultimos) {
            val abs = kotlin.math.abs(m.montoSigned)
            val signo = if (m.montoSigned < 0) "-" else "+"
            blocks.add(PrintBlock.Text(fechaCorta(m.fechaIso), 24f, false, 0))
            blocks.add(
                PrintBlock.Text(
                    "  $signo ${MoneyFormat.format(abs)}  Saldo ${MoneyFormat.format(m.saldoTras)}",
                    24f, false, 0,
                ),
            )
        }
        blocks.add(PrintBlock.Line)
        blocks.add(PrintBlock.Text("Ticket no fiscal", 24f, false))
        blocks.add(PrintBlock.Feed)

        return PrinterRouter.printBlocks(ctx, null, blocks).isSuccess
    }

    private fun fechaCorta(iso: String): String {
        if (iso.isBlank()) return "--"
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd",
        )
        var t = 0L
        for (p in patterns) {
            try {
                t = SimpleDateFormat(p, Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.parse(iso)?.time ?: 0L
                if (t != 0L) break
            } catch (_: Exception) {}
        }
        if (t == 0L) return iso
        return try {
            SimpleDateFormat("dd/MM/yyyy - HH:mm", Locale("es", "AR")).format(Date(t))
        } catch (_: Exception) {
            iso
        }
    }
}

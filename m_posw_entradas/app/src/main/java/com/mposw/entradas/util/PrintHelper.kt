package com.mposw.entradas.util

import android.content.Context
import com.google.gson.Gson
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSale
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.ui.pos.PosTicketRenderer

/**
 * Reimprime la última venta aprobada guardada. Extraído de PosCartSheet
 * para reutilizarlo (diálogo de pago aprobado). No inventa lógica.
 */
object PrintHelper {
    suspend fun reprintLast(ctx: Context): Boolean {
        val repo = PosSalesRepo(ctx, SessionManager(ctx))
        val last = repo.lastApproved() ?: return false
        val sale = try {
            Gson().fromJson(last.payloadJson, PosSale::class.java)
        } catch (_: Exception) {
            null
        } ?: return false
        return PosTicketRenderer.print(ctx, sale)
    }
}

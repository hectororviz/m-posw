package com.mposw.entradas.data.pos

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.gson.Gson
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.ApiService
import com.mposw.entradas.data.PosApprovedSale
import com.mposw.entradas.data.PosCanjeInput
import com.mposw.entradas.data.PosCanjesRequest
import com.mposw.entradas.data.PosCashRequest
import com.mposw.entradas.data.PosDb
import com.mposw.entradas.data.PosQrRequest
import com.mposw.entradas.data.PosSaleItemInput
import com.mposw.entradas.data.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Ventas del modo POS: intents, estado, cancelación, canjes y QR estático.
 * Espejo del flujo web (CheckoutModal): cash aprueba directo, QR pullea
 * estado y al aprobar trae la venta completa para imprimir.
 */
class PosSalesRepo(ctx: Context, private val session: SessionManager) {
    private val appCtx = ctx.applicationContext
    private val api: ApiService get() = ApiClient.service(session)
    private val gson = Gson()

    fun itemsOf(cart: PosCart) =
        cart.lines.map { PosSaleItemInput(it.product.id, it.quantity) }

    suspend fun cash(cart: PosCart, cashReceived: Double, change: Double) =
        api.posCash(
            PosCashRequest(
                items = itemsOf(cart),
                total = cart.total,
                cashReceived = cashReceived,
                changeAmount = change,
                discountTotal = cart.discountTotal.takeIf { it > 0 },
                socioId = cart.socioId,
                canjes = cart.canjes().takeIf { it.isNotEmpty() },
            ),
        )

    suspend fun qr(cart: PosCart) =
        api.posQr(
            PosQrRequest(
                items = itemsOf(cart),
                total = cart.total,
                discountTotal = cart.discountTotal.takeIf { it > 0 },
                socioId = cart.socioId,
                canjes = cart.canjes().takeIf { it.isNotEmpty() },
            ),
        )

    suspend fun sale(saleId: String) = api.posSale(saleId)
    suspend fun status(saleId: String) = api.posStatus(saleId)
    suspend fun cancel(saleId: String) = api.posCancel(saleId)

    suspend fun markPrinted(saleId: String) {
        try { api.posTicketPrinted(saleId) } catch (_: Exception) {}
    }

    /** Registro de canjes post-venta: no bloquea si falla (igual que la web). */
    suspend fun registerCanjes(cart: PosCart, saleId: String) {
        val socioId = cart.socioId ?: return
        if (cart.canjes().isEmpty()) return
        try {
            api.posCanjes(PosCanjesRequest(socioId.toString(), saleId, cart.canjes()))
        } catch (_: Exception) {}
    }

    suspend fun consumeEntradaBenefit(code: String) {
        api.consumirBeneficio(code.trim())
    }

    suspend fun mpQr() = api.posMpQr()

    suspend fun socio(uuid: String) = api.socio(uuid.trim())

    suspend fun validarBeneficio(code: String) = api.validarBeneficio(code.trim())

    suspend fun saveApproved(saleId: String, payloadJson: String) {
        try { PosDb.get(appCtx).sales().upsert(PosApprovedSale(saleId, payloadJson)) } catch (_: Exception) {}
    }

    suspend fun lastApproved(): PosApprovedSale? =
        try { PosDb.get(appCtx).sales().last() } catch (_: Exception) { null }

    fun saleToJson(sale: Any): String = gson.toJson(sale)

    suspend fun downloadBitmap(url: String): Bitmap? = withContext(Dispatchers.IO) {
        if (url.isBlank()) return@withContext null
        try {
            val client = OkHttpClient.Builder()
                .connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .build()
            val resp = client.newCall(Request.Builder().url(url).build()).execute()
            resp.use {
                if (!it.isSuccessful) return@withContext null
                val bytes = it.body?.bytes() ?: return@withContext null
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }
        } catch (_: Exception) {
            null
        }
    }
}

package com.mposw.entradas.data.pos

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.ApiService
import com.mposw.entradas.data.PosCache
import com.mposw.entradas.data.PosCatalogResponse
import com.mposw.entradas.data.PosDb
import com.mposw.entradas.data.SessionManager

/**
 * Catálogo en memoria + copia en pos.db para arranque offline.
 * La venta siempre es online; el catálogo puede mostrarse cacheado.
 */
class PosCatalogRepo(ctx: Context, private val session: SessionManager) {
    private val appCtx = ctx.applicationContext
    private val api: ApiService get() = ApiClient.service(session)
    private val gson = Gson()

    var catalog: PosCatalogResponse? = null
        private set

    suspend fun load(): PosCatalogResponse {
        return try {
            val fresh = api.posCatalog()
            catalog = fresh
            try {
                PosDb.get(appCtx).cache().upsert(PosCache(PosDb.CATALOG_KEY, gson.toJson(fresh)))
            } catch (_: Exception) {}
            try {
                syncBranding()
            } catch (_: Exception) {}
            fresh
        } catch (e: Exception) {
            val cached = try {
                PosDb.get(appCtx).cache().byKey(PosDb.CATALOG_KEY)?.json?.let {
                    gson.fromJson<PosCatalogResponse>(it, object : TypeToken<PosCatalogResponse>() {}.type)
                }
            } catch (_: Exception) { null }
            if (cached != null) {
                catalog = cached
                cached
            } else throw e
        }
    }

    /** Escudo, colores y nombres para el encabezado del ticket (endpoints agnósticos). */
    private suspend fun syncBranding() {
        val t = api.template()
        session.templateJson = gson.toJson(t)
        session.templateVersion = t.version
        val e = api.escudo()
        session.escudoBase64 = e.pngBase64 ?: ""
        session.logoVersion = e.version
        session.brandColor = e.accentColor ?: ""
        session.clubName = e.clubName ?: ""
        session.logoPath = e.logoUrl ?: ""
        try {
            val s = api.posSettings()
            if (!s.storeName.isNullOrBlank()) session.storeName = s.storeName
            if (!s.clubName.isNullOrBlank()) session.clubName = s.clubName
        } catch (_: Exception) {}
    }

    fun productsOf(categoryId: String) =
        catalog?.products?.filter { it.categoryId == categoryId } ?: emptyList()
}

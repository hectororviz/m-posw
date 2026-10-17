package com.mposw.entradas.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.UUID
import java.util.concurrent.TimeUnit

class EntradasRepo(private val session: SessionManager) {
    private val api: ApiService get() = ApiClient.service(session)
    private val gson get() = ApiClient.gson

    suspend fun vigentes() = api.vigentes()

    suspend fun intent(
        fixtureId: String?,
        eventoId: String?,
        sector: String?,
        cantidad: Int,
        method: String,
        socioUuid: String?,
    ): Pair<String, StatusPayload> {
        val reqId = UUID.randomUUID().toString()
        val payload = api.intent(IntentRequest(fixtureId, eventoId, sector, cantidad, method, socioUuid), reqId)
        return reqId to payload
    }

    suspend fun status(saleId: String) = api.status(saleId)

    suspend fun cancel(saleId: String) = api.cancel(saleId)

    suspend fun socio(uuid: String) = api.socio(uuid.trim())

    suspend fun syncTemplateIfNeeded(templateId: String?, tplV: Int, logoV: Int) {
        if (templateId == "evento") {
            if (session.templateEventoVersion != tplV || session.templateEventoJson.isBlank()) {
                val t = api.template("evento")
                session.templateEventoJson = gson.toJson(t)
                session.templateEventoVersion = t.version
            }
        } else if (session.templateVersion != tplV || session.templateJson.isBlank()) {
            val t = api.template(null)
            session.templateJson = gson.toJson(t)
            session.templateVersion = t.version
        }
        if (session.logoVersion != logoV || session.escudoBase64.isBlank()) {
            val e = api.escudo()
            session.escudoBase64 = e.pngBase64 ?: ""
            session.logoVersion = e.version
            session.brandColor = e.accentColor ?: ""
            session.clubName = e.clubName ?: ""
            session.logoPath = e.logoUrl ?: ""
        }
    }

    suspend fun syncTemplateForce() {
        val t = api.template(null)
        session.templateJson = gson.toJson(t)
        session.templateVersion = t.version
        val te = api.template("evento")
        session.templateEventoJson = gson.toJson(te)
        session.templateEventoVersion = te.version
        val e = api.escudo()
        session.escudoBase64 = e.pngBase64 ?: ""
        session.logoVersion = e.version
        session.brandColor = e.accentColor ?: ""
        session.clubName = e.clubName ?: ""
        session.logoPath = e.logoUrl ?: ""
    }

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

    fun payloadToJson(p: StatusPayload): String = gson.toJson(p)
    fun payloadFromJson(json: String): StatusPayload? =
        try { gson.fromJson(json, StatusPayload::class.java) } catch (_: Exception) { null }
}

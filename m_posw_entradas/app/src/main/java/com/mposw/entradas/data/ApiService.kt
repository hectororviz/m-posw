package com.mposw.entradas.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @GET("entradas/fixtures/vigentes")
    suspend fun vigentes(): VigentesResponse

    @POST("entradas/sales/intent")
    suspend fun intent(
        @Body body: IntentRequest,
        @Header("X-Request-Id") requestId: String,
    ): StatusPayload

    @GET("entradas/sales/{id}/status")
    suspend fun status(@Path("id") saleId: String): StatusPayload

    @POST("entradas/sales/{id}/cancel")
    suspend fun cancel(@Path("id") saleId: String): StatusPayload

    @GET("entradas/ticket-template")
    suspend fun template(): TemplateResponse

    @GET("entradas/ticket-assets/escudo")
    suspend fun escudo(): EscudoResponse

    @GET("entradas/socios/{uuid}")
    suspend fun socio(@Path("uuid") uuid: String): SocioLookupResponse
}

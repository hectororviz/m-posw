package com.mposw.entradas.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @GET("entradas/devices/me")
    suspend fun me(): DeviceMeResponse

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

    @GET("entradas/beneficios/{code}")
    suspend fun validarBeneficio(@Path("code") code: String): PosBenefitValidation

    @POST("entradas/beneficios/{code}/consumir")
    suspend fun consumirBeneficio(@Path("code") code: String): Any

    // ── POS bufet (solo terminales tipo POS) ──
    @GET("pos-device/catalog")
    suspend fun posCatalog(): PosCatalogResponse

    @GET("pos-device/mp-qr")
    suspend fun posMpQr(): PosMpQrResponse

    @GET("pos-device/settings")
    suspend fun posSettings(): PosSettingsResponse

    @POST("pos-device/sales/cash")
    suspend fun posCash(@Body body: PosCashRequest): PosSale

    @POST("pos-device/sales/qr")
    suspend fun posQr(@Body body: PosQrRequest): PosQrIntentResponse

    @GET("pos-device/sales/{id}")
    suspend fun posSale(@Path("id") saleId: String): PosSale

    @GET("pos-device/sales/{id}/status")
    suspend fun posStatus(@Path("id") saleId: String): PosSaleStatus

    @POST("pos-device/sales/{id}/cancel")
    suspend fun posCancel(@Path("id") saleId: String): PosSaleStatus

    @POST("pos-device/sales/{id}/ticket-printed")
    suspend fun posTicketPrinted(@Path("id") saleId: String): Any

    @POST("pos-device/socios/canjes")
    suspend fun posCanjes(@Body body: PosCanjesRequest): Any
}

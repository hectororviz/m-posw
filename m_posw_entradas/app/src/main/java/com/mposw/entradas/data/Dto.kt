package com.mposw.entradas.data

import com.google.gson.annotations.SerializedName

data class VigentesResponse(
    val now: String?,
    val fixtures: List<FixtureVigente> = emptyList(),
)

data class FixtureVigente(
    val fixtureId: String,
    val fecha: String?,
    val torneo: String,
    val torneoId: String?,
    val rival: String,
    val rivalId: String?,
    val precio: String,
    val vendidosL: Int = 0,
    val vendidosV: Int = 0,
    val ventanaDesde: String?,
    val ventanaHasta: String?,
) {
    val precioDouble: Double get() = precio.toDoubleOrNull() ?: 0.0
    override fun toString(): String = "$torneo vs $rival"
}

data class IntentRequest(
    val fixtureId: String,
    val sector: String,
    val cantidad: Int,
    val paymentMethod: String,
    val socioUuid: String?,
)

data class StatusPayload(
    val saleId: String?,
    val status: String?,
    val codigos: List<String>? = emptyList(),
    val cantidad: Int = 0,
    val precioUnit: String? = "0",
    val descuento: String? = "0",
    val total: String? = "0",
    val paymentMethod: String?,
    val datos: DatosTicket?,
    val qrImageUrl: String?,
    val templateVersion: Int = 1,
    val logoVersion: Int = 1,
    val beneficios: List<SaleBeneficio> = emptyList(),
)

// Beneficio de bufet por unidad (QR `ENT:<benefitCode>`). Vacío si la entrada no tiene.
data class SaleBeneficio(
    val codigo: String?,
    val benefitCode: String?,
    val qr: String?,
    val beneficioId: String?,
    val beneficioNombre: String?,
    val porcentaje: String?,
    val usoUnico: Boolean?,
)

data class DatosTicket(
    val club: String?,
    val torneo: String?,
    val rival: String?,
    val fecha: String?,
    val sector: String?,
    val ventaId: String?,
    val fechaPago: String?,
    val footer: String?,
    val qrImageUrl: String?,
)

data class TemplateResponse(
    val id: String?,
    val version: Int,
    val widthCols: Int = 32,
    val layout: TemplateLayout?,
)

data class TemplateLayout(
    val widthCols: Int = 32,
    val elements: List<TemplateElement> = emptyList(),
)

data class TemplateElement(
    val type: String,
    val value: String?,
    val size: String?,
    val align: String?,
    val bold: Boolean = false,
    val enabled: Boolean = true,
)

data class EscudoResponse(
    val id: String?,
    val version: Int,
    val pngBase64: String?,
    val widthPx: Int = 256,
    val accentColor: String?,
    val clubName: String?,
    val logoUrl: String?,
)

data class SocioLookupResponse(
    val socio: SocioInfo?,
    val estado: String?,
    val beneficios: List<SocioBeneficio> = emptyList(),
)

data class SocioInfo(
    val id: Int,
    val nombre: String?,
    val nroSocio: String?,
    val tipo: String?,
)

data class SocioBeneficio(
    val id: String?,
    val porcentaje: Double = 0.0,
    val disponible: Boolean = true,
)

data class ErrorBody(
    @SerializedName("code") val code: String?,
    @SerializedName("message") val message: String?,
    @SerializedName("statusCode") val statusCode: Int?,
)

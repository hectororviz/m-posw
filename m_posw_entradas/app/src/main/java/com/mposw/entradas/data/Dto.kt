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
    val categoriaId: String?,
    val categoriaNombre: String?,
    val productoId: String?,
    val productoNombre: String?,
    val porcentaje: Double = 0.0,
    val descuentoMaximo: Double?,
    val limiteDiario: Int?,
    val disponible: Boolean = true,
    val motivoNoDisponible: String?,
)

data class ErrorBody(
    @SerializedName("code") val code: String?,
    @SerializedName("message") val message: String?,
    @SerializedName("statusCode") val statusCode: Int?,
)

/** Identidad y modo del propio dispositivo. El modo lo define el servidor. */
data class DeviceMeResponse(
    val id: String?,
    val nombre: String?,
    val tipo: String?,
)

// ── POS bufet (pos-device) ──────────────────────────────────

data class PosCatalogResponse(
    val categories: List<PosCategory> = emptyList(),
    val products: List<PosProduct> = emptyList(),
)

data class PosCategory(
    val id: String,
    val name: String,
    val iconName: String?,
    val colorHex: String?,
    val ticket: Boolean = true,
)

data class PosProduct(
    val id: String,
    val name: String,
    val price: Double = 0.0,
    val stock: Double = 0.0,
    val type: String?,
    val iconName: String?,
    val colorHex: String?,
    val imagePath: String?,
    val imageUpdatedAt: String?,
    val categoryId: String?,
    val category: PosProductCategory?,
) {
    /** URL absoluta de la foto (igual que buildImageUrl web), o null. */
    fun imageUrl(apiRoot: String): String? {
        var p = imagePath?.trim().orEmpty()
        if (p.isEmpty()) return null
        if (p.startsWith("http")) return p
        if (!p.startsWith("/")) p = "/$p"
        val root = apiRoot.trim().trimEnd('/')
        val ts = imageUpdatedAt?.trim().orEmpty()
        return root + p + if (ts.isNotEmpty()) "?v=$ts" else ""
    }
}

data class PosProductCategory(
    val id: String?,
    val name: String?,
    val ticket: Boolean = true,
)

data class PosMpQrResponse(
    val qrData: String?,
    val linked: Boolean = false,
)

data class PosSettingsResponse(
    val storeName: String?,
    val clubName: String?,
)

data class PosSaleItemInput(
    val productId: String,
    val quantity: Int,
)

data class PosCanjeInput(
    val socioBeneficioId: String,
    val montoDescontado: Double,
)

data class PosCashRequest(
    val items: List<PosSaleItemInput>,
    val total: Double,
    val paymentMethod: String = "CASH",
    val cashReceived: Double,
    val changeAmount: Double,
    val discountTotal: Double? = null,
    val socioId: Int? = null,
    val canjes: List<PosCanjeInput>? = null,
)

data class PosQrRequest(
    val items: List<PosSaleItemInput>,
    val total: Double,
    val paymentMethod: String = "MP_QR",
    val discountTotal: Double? = null,
    val socioId: Int? = null,
    val canjes: List<PosCanjeInput>? = null,
)

data class PosQrIntentResponse(
    val saleId: String?,
    val orderNumber: Int = 0,
    val status: String?,
)

data class PosSaleStatus(
    val saleId: String?,
    val orderNumber: Int = 0,
    val status: String?,
    val updatedAt: String?,
)

data class PosSale(
    val id: String?,
    val orderNumber: Int = 0,
    val total: String?,
    val status: String?,
    val paymentStatus: String?,
    val paymentMethod: String?,
    val cashReceived: String?,
    val changeAmount: String?,
    val paidAt: String?,
    val createdAt: String?,
    val items: List<PosSaleItem> = emptyList(),
    val vouchers: List<PosSaleVoucher> = emptyList(),
)

data class PosSaleItem(
    val quantity: Int = 0,
    val subtotal: String?,
    val orderNumber: Int = 0,
    val product: PosSaleProduct?,
)

data class PosSaleProduct(
    val name: String?,
    val category: PosProductCategory?,
)

data class PosSaleVoucher(
    val pin: String?,
    val plan: PosVoucherPlan?,
)

data class PosVoucherPlan(
    val name: String?,
    val duration: Int = 0,
)

data class PosCanjesRequest(
    val socioId: String,
    val ventaId: String,
    val canjes: List<PosCanjeInput>,
)

data class PosBenefitValidation(
    val code: String?,
    val codigo: String?,
    val beneficio: PosBenefitInfo?,
    val consumido: Boolean = false,
    val disponible: Boolean = false,
    val motivoNoDisponible: String?,
)

data class PosBenefitInfo(
    val id: String?,
    val nombre: String?,
    val porcentaje: String?,
    val descuentoMaximo: String?,
    val usoUnico: Boolean = true,
    val destino: PosBenefitDestino?,
)

data class PosBenefitDestino(
    val categoria: PosDestinoRef?,
    val producto: PosDestinoRef?,
    val internetPlan: PosDestinoRef?,
)

data class PosDestinoRef(
    val id: String?,
    val name: String?,
)

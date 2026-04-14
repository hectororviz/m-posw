package com.mposw.app.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    val name: String,
    val email: String? = null,
    val role: String = "USER",
    val active: Boolean = true,
    val externalPosId: String? = null,
    val externalStoreId: String? = null
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    val accessToken: String,
    val user: User
)

@JsonClass(generateAdapter = true)
data class Category(
    val id: String,
    val name: String,
    val iconName: String = "category",
    val colorHex: String = "#64748b",
    val imagePath: String? = null,
    val imageUpdatedAt: String? = null,
    val active: Boolean = true
)

@JsonClass(generateAdapter = true)
data class Product(
    val id: String,
    val name: String,
    val price: Double,
    val iconName: String? = null,
    val colorHex: String? = null,
    val imagePath: String? = null,
    val imageUpdatedAt: String? = null,
    val active: Boolean = true,
    val categoryId: String,
    val category: Category? = null
)

@JsonClass(generateAdapter = true)
data class SaleItem(
    val id: String,
    val productId: String,
    val quantity: Int,
    val subtotal: Double,
    val product: Product
)

@JsonClass(generateAdapter = true)
data class SaleUser(
    val id: String,
    val name: String,
    val email: String? = null
)

@JsonClass(generateAdapter = true)
data class Sale(
    val id: String,
    val total: Double,
    val status: String = "PENDING",
    val paymentMethod: String? = null,
    val cashReceived: Double? = null,
    val changeAmount: Double? = null,
    val createdAt: String,
    val paidAt: String? = null,
    val ticketPrintedAt: String? = null,
    val items: List<SaleItem> = emptyList(),
    val user: SaleUser? = null
)

@JsonClass(generateAdapter = true)
data class ManualMovement(
    val id: String,
    val createdAt: String,
    val type: String,
    val amount: Double,
    val reason: String,
    val userId: String
)

@JsonClass(generateAdapter = true)
data class Setting(
    val storeName: String? = null,
    val clubName: String? = null,
    val enableTicketPrinting: Boolean? = null,
    val logoUrl: String? = null,
    val faviconUrl: String? = null,
    val okAnimationUrl: String? = null,
    val errorAnimationUrl: String? = null,
    val accentColor: String? = null
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val name: String? = null,
    val email: String? = null,
    val pin: String
)

@JsonClass(generateAdapter = true)
data class CreateSaleRequest(
    val items: List<SaleItemInput>,
    val paymentMethod: String,
    val cashReceived: Double? = null
)

@JsonClass(generateAdapter = true)
data class SaleItemInput(
    val productId: String,
    val quantity: Int
)

@JsonClass(generateAdapter = true)
data class CompleteSaleResponse(
    val sale: Sale,
    val qrCode: String? = null
)

@JsonClass(generateAdapter = true)
data class PaymentStatusResponse(
    val saleId: String,
    val status: String,
    val mpStatus: String? = null,
    val mpStatusDetail: String? = null,
    val paymentId: String? = null,
    val merchantOrderId: String? = null,
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ApiError(
    val message: String? = null
)
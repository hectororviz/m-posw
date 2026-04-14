package com.mposw.app.data.api

import com.mposw.app.data.model.*
import retrofit2.http.*

interface ApiService {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): retrofit2.Response<AuthResponse>

    @GET("auth/login-users")
    suspend fun getLoginUsers(): retrofit2.Response<List<User>>

    @GET("categories")
    suspend fun getCategories(): retrofit2.Response<List<Category>>

    @GET("categories/{id}/products")
    suspend fun getProductsByCategory(@Path("id") categoryId: String): retrofit2.Response<List<Product>>

    @GET("products")
    suspend fun getProducts(): retrofit2.Response<List<Product>>

    @POST("sales")
    suspend fun createSale(@Body request: CreateSaleRequest): retrofit2.Response<Sale>

    @GET("sales/{id}")
    suspend fun getSale(@Path("id") saleId: String): retrofit2.Response<Sale>

    @POST("sales/{id}/complete")
    suspend fun completeSale(@Path("id") saleId: String): retrofit2.Response<Sale>

    @GET("sales/{id}/payment-status")
    suspend fun getPaymentStatus(@Path("id") saleId: String): retrofit2.Response<PaymentStatusResponse>

    @GET("sales")
    suspend fun getSales(
        @Query("startDate") startDate: String? = null,
        @Query("endDate") endDate: String? = null
    ): retrofit2.Response<List<Sale>>

    @POST("sales/{id}/print")
    suspend fun markTicketPrinted(@Path("id") saleId: String): retrofit2.Response<Unit>

    @POST("movements")
    suspend fun createMovement(@Body movement: ManualMovement): retrofit2.Response<ManualMovement>

    @GET("movements")
    suspend fun getMovements(): retrofit2.Response<List<ManualMovement>>

    @GET("settings")
    suspend fun getSettings(): retrofit2.Response<Setting>

    @PUT("settings")
    suspend fun updateSettings(@Body settings: Setting): retrofit2.Response<Setting>

    @POST("categories")
    suspend fun createCategory(@Body category: Category): retrofit2.Response<Category>

    @PUT("categories/{id}")
    suspend fun updateCategory(@Path("id") id: String, @Body category: Category): retrofit2.Response<Category>

    @DELETE("categories/{id}")
    suspend fun deleteCategory(@Path("id") id: String): retrofit2.Response<Unit>

    @POST("products")
    suspend fun createProduct(@Body product: Product): retrofit2.Response<Product>

    @PUT("products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body product: Product): retrofit2.Response<Product>

    @DELETE("products/{id}")
    suspend fun deleteProduct(@Path("id") id: String): retrofit2.Response<Unit>

    @GET("stats")
    suspend fun getStats(
        @Query("startDate") startDate: String? = null,
        @Query("endDate") endDate: String? = null
    ): retrofit2.Response<Map<String, Any>>
}
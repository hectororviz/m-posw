package com.mposw.entradas.data

import com.google.gson.GsonBuilder
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    fun service(session: SessionManager, qrReadTimeoutSec: Long = 20): ApiService {
        val auth = Interceptor { chain ->
            val req = chain.request().newBuilder()
                .addHeader("Authorization", "Bearer ${session.token}")
                .addHeader("Content-Type", "application/json")
                .build()
            chain.proceed(req)
        }
        val log = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val ok = OkHttpClient.Builder()
            .addInterceptor(auth)
            .addInterceptor(log)
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(qrReadTimeoutSec, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
        val gson = GsonBuilder().create()
        return Retrofit.Builder()
            .baseUrl(session.baseUrl.ifBlank { "https://localhost/api/" })
            .client(ok)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }

    fun parseError(e: Exception): String {
        val msg = e.message ?: "Error de red"
        return when {
            msg.contains("401") -> "No autorizado (401). Revisá el token o re-vinculá."
            msg.contains("DEVICE_REVOKED") -> "Dispositivo revocado. Re-vinculá."
            else -> msg
        }
    }
}

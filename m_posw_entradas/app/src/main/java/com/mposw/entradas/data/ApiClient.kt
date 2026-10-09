package com.mposw.entradas.data

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.TypeAdapter
import com.google.gson.TypeAdapterFactory
import com.google.gson.reflect.TypeToken
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.stream.JsonWriter
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Gson no ejecuta constructores Kotlin (instancia vía Unsafe): ante un
 * `null` explícito devuelve null aunque el campo declare default, y las
 * claves ausentes ni siquiera pasan por el adapter. En lectura, toda
 * colección null colapsa a lista vacía (las claves ausentes se cubren
 * con tipos `List?` + `?: emptyList()` en los DTOs). En escritura delega
 * tal cual para no alterar los requests.
 */
private class NullCollectionFactory : TypeAdapterFactory {
    override fun <T> create(gson: Gson, type: TypeToken<T>): TypeAdapter<T>? {
        if (!Collection::class.java.isAssignableFrom(type.rawType)) return null
        @Suppress("UNCHECKED_CAST")
        val delegate = gson.getDelegateAdapter(this, type) as TypeAdapter<Collection<Any?>>
        @Suppress("UNCHECKED_CAST")
        return object : TypeAdapter<T>() {
            override fun write(out: JsonWriter, value: T) {
                if (value == null) {
                    out.nullValue()
                    return
                }
                delegate.write(out, value as Collection<Any?>)
            }

            override fun read(reader: JsonReader): T {
                if (reader.peek() == JsonToken.NULL) {
                    reader.nextNull()
                    return emptyList<Any?>() as T
                }
                return (delegate.read(reader) ?: emptyList<Any?>()) as T
            }
        }
    }
}

object ApiClient {
    /** Gson compartido: con colapso de colecciones null (ver arriba). */
    val gson: Gson = GsonBuilder()
        .registerTypeAdapterFactory(NullCollectionFactory())
        .create()

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
            isWrongMode(e) -> "Modo incorrecto para esta terminal. Pedí que lo cambien en el front."
            else -> msg
        }
    }

    /** 403 del guard de dispositivo = el servidor cambió el modo. */
    fun isWrongMode(e: Exception): Boolean {
        val code = (e as? retrofit2.HttpException)?.code()
        if (code == 403) return true
        val msg = e.message ?: ""
        return msg.contains("403") || msg.contains("DEVICE_WRONG_MODE")
    }
}

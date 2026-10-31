package com.mposw.entradas.data.pos

import android.content.Context
import com.mposw.entradas.data.PosProduct
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Caché propia de fotos de productos en filesDir (no depende de la caché
 * de disco de Coil): cada foto es `<productId>_<v>.webp` donde `v` es el
 * `imageUpdatedAt` del catálogo. Si el archivo existe y el `v` coincide se
 * usa sin red; si cambió o falta se descarga. Sin red, el adapter muestra
 * lo guardado.
 */
object ProductImageStore {
    private const val DIR = "product_images"

    private val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val slots = Semaphore(4)

    private fun sanitize(v: String): String = v.replace(Regex("[^A-Za-z0-9._-]"), "_").take(64)

    private fun dir(ctx: Context): File = File(ctx.filesDir, DIR)

    fun fileFor(ctx: Context, productId: String, updatedAt: String?): File? {
        val v = updatedAt?.trim().orEmpty()
        if (v.isEmpty()) return null
        return File(dir(ctx), "${productId}_${sanitize(v)}.webp")
    }

    /** Archivo local vigente, o null si hay que descargarlo (o no tiene foto versionada). */
    fun freshFile(ctx: Context, product: PosProduct): File? {
        return try {
            fileFor(ctx, product.id, product.imageUpdatedAt)?.takeIf { it.exists() }
        } catch (_: Exception) {
            null
        }
    }

    data class Stats(val local: Int, val total: Int, val mb: Long)

    fun stats(ctx: Context, products: List<PosProduct>): Stats {
        var local = 0
        var bytes = 0L
        var total = 0
        for (p in products) {
            if (p.imagePath?.trim().isNullOrEmpty()) continue
            total++
            try {
                val f = freshFile(ctx, p)
                if (f != null) {
                    local++
                    bytes += f.length()
                }
            } catch (_: Exception) {
            }
        }
        return Stats(local, total, bytes / (1024 * 1024))
    }

    /**
     * Descarga lo que falta/cambió (4 en paralelo) y borra archivos que ya
     * no están en el catálogo. También limpia la vieja caché de Coil en
     * cacheDir, que quedó en desuso.
     */
    suspend fun sync(ctx: Context, apiRoot: String, products: List<PosProduct>) = withContext(Dispatchers.IO) {
        val appCtx = ctx.applicationContext
        try {
            dir(appCtx).mkdirs()
        } catch (_: Exception) {
        }
        try {
            File(appCtx.cacheDir, "pos_images").takeIf { it.exists() }?.deleteRecursively()
        } catch (_: Exception) {
        }
        val wanted = mutableSetOf<String>()
        val jobs = products.mapNotNull { p ->
            val path = p.imagePath?.trim().orEmpty()
            val v = p.imageUpdatedAt?.trim().orEmpty()
            if (path.isEmpty() || v.isEmpty()) return@mapNotNull null
            val target = try {
                File(dir(appCtx), "${p.id}_${sanitize(v)}.webp")
            } catch (_: Exception) {
                return@mapNotNull null
            }
            wanted.add(target.name)
            if (target.exists()) return@mapNotNull null
            async {
                slots.withPermit { downloadTo(apiRoot, path, v, target) }
            }
        }
        try {
            jobs.awaitAll()
        } catch (_: Exception) {
        }
        try {
            dir(appCtx).listFiles()?.forEach {
                if (it.isFile && it.name !in wanted && !it.name.endsWith(".tmp")) it.delete()
            }
        } catch (_: Exception) {
        }
    }

    private suspend fun downloadTo(apiRoot: String, path: String, v: String, target: File) =
        withContext(Dispatchers.IO) {
            try {
                var p = path.trim()
                if (p.isEmpty()) return@withContext
                if (!p.startsWith("/")) p = "/$p"
                val url = apiRoot.trim().trimEnd('/') + p + "?v=$v"
                val req = Request.Builder().url(url).get().build()
                http.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext
                    val body = resp.body ?: return@withContext
                    val tmp = File(target.parent, target.name + ".tmp")
                    body.byteStream().use { input ->
                        tmp.outputStream().use { out -> input.copyTo(out) }
                    }
                    tmp.renameTo(target)
                }
            } catch (_: Exception) {
            }
        }
}

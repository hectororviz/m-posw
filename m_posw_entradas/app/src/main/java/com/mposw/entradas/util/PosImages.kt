package com.mposw.entradas.util

import android.content.Context
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.request.CachePolicy
import coil.request.ImageRequest

/**
 * Imágenes del POS: Coil con disco fijo (128 MB, dir propia) + RGB_565
 * (las fotos no usan alfa: mitad de RAM y decode más rápido en el Sunmi).
 * Se inicializa en MainActivity antes de cualquier `load()`.
 */
object PosImages {
    fun init(ctx: Context) {
        try {
            val appCtx = ctx.applicationContext
            Coil.setImageLoader(
                ImageLoader.Builder(appCtx)
                    .diskCache {
                        DiskCache.Builder()
                            .directory(appCtx.cacheDir.resolve("pos_images"))
                            .maxSizeBytes(128L * 1024 * 1024)
                            .build()
                    }
                    .allowRgb565(true)
                    .build(),
            )
        } catch (_: IllegalStateException) {
            // Ya inicializado (recreación de actividad): se conserva.
        }
    }

    /** MB ocupados en disco, o null si no se pudo medir. */
    fun diskCacheMb(ctx: Context): Long? {
        return try {
            val size = Coil.imageLoader(ctx).diskCache?.size ?: return null
            size / (1024 * 1024)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Precalienta la caché de disco con una lista de URLs (sin tocar la
     * memoria). Fire-and-forget: Coil encola en segundo plano.
     */
    fun prefetch(ctx: Context, urls: List<String>) {
        if (urls.isEmpty()) return
        try {
            val loader = Coil.imageLoader(ctx)
            for (u in urls.take(24)) {
                loader.enqueue(
                    ImageRequest.Builder(ctx)
                        .data(u)
                        .size(512)
                        .memoryCachePolicy(CachePolicy.DISABLED)
                        .diskCachePolicy(CachePolicy.ENABLED)
                        .build(),
                )
            }
        } catch (_: Exception) {
        }
    }
}

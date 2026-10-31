package com.mposw.entradas.util

import android.content.Context
import coil.Coil
import coil.ImageLoader

/**
 * Imágenes del POS: Coil con RGB_565 (las fotos no usan alfa: mitad de RAM
 * y decode más rápido en el Sunmi). La persistencia en disco es propia
 * ([com.mposw.entradas.data.pos.ProductImageStore]), no la de Coil.
 * Se inicializa en MainActivity antes de cualquier `load()`.
 */
object PosImages {
    fun init(ctx: Context) {
        try {
            Coil.setImageLoader(
                ImageLoader.Builder(ctx.applicationContext)
                    .allowRgb565(true)
                    .build(),
            )
        } catch (_: IllegalStateException) {
            // Ya inicializado (recreación de actividad): se conserva.
        }
    }
}

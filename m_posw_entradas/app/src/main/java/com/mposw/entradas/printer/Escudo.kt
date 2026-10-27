package com.mposw.entradas.printer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.util.Base64

/**
 * Escudo/logo: decode + raster 1-bit para ESC/POS. Sin dependencia de
 * hardware (SunmiPrinter.escudoBitmap delega acá).
 */
object Escudo {
    fun decode(base64Png: String): Bitmap? {
        if (base64Png.isBlank()) return null
        return try {
            val bytes = Base64.decode(base64Png, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    data class MonoRaster(val widthPx: Int, val heightPx: Int, val bytes: ByteArray)

    /**
     * Umbraliza a B/N puro sobre fondo blanco (igual criterio que Sunmi:
     * luminancia < 128 → negro) y empaqueta en filas de bytes MSB-first
     * para `GS v 0`. maxW default 384 = 58mm a 203dpi.
     */
    fun toMonoRaster(src: Bitmap?, maxW: Int = 384): MonoRaster? {
        if (src == null) return null
        return try {
            val scale = if (src.width > maxW) maxW.toFloat() / src.width else 1f
            val w = (src.width * scale).toInt().coerceAtLeast(1)
            val h = (src.height * scale).toInt().coerceAtLeast(1)
            val scaled = Bitmap.createScaledBitmap(src, w, h, true)
            val flat = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(flat)
            canvas.drawColor(Color.WHITE)
            canvas.drawBitmap(scaled, 0f, 0f, null)
            val pixels = IntArray(w * h)
            flat.getPixels(pixels, 0, w, 0, 0, w, h)
            val rowBytes = (w + 7) / 8
            val out = ByteArray(rowBytes * h)
            for (y in 0 until h) {
                for (x in 0 until w) {
                    val p = pixels[y * w + x]
                    val lum = (0.299 * Color.red(p) + 0.587 * Color.green(p) + 0.114 * Color.blue(p)).toInt()
                    if (lum < 128) {
                        out[y * rowBytes + x / 8] = (out[y * rowBytes + x / 8].toInt() or (0x80 shr (x % 8))).toByte()
                    }
                }
            }
            MonoRaster(w, h, out)
        } catch (_: Exception) {
            null
        }
    }
}

package com.mposw.entradas.printer

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/**
 * Convierte [PrintBlock]s a comandos ESC/POS para impresoras térmicas
 * Bluetooth de 58mm (32 columnas). Puerto del generador de la app Flutter
 * discontinuada (`_generateEscPosCommands`): mismo layout, reset, codepage,
 * separadores, QR y corte.
 */
object EscPosEncoder {
    const val COLS = 32
    private const val SEP = "--------------------------------"

    private val cp1252: Charset by lazy {
        try {
            charset("windows-1252")
        } catch (_: Exception) {
            Charsets.ISO_8859_1
        }
    }

    fun encode(blocks: List<PrintBlock>): ByteArray {
        val out = ByteArrayOutputStream()
        // Reset
        out.write(byteArrayOf(0x1B, 0x40))
        // Codepage CP1252 (tildes/ñ). Si la impresora no la soporta,
        // igual imprime: solo los acentos pueden salir distintos.
        out.write(byteArrayOf(0x1B, 0x74, 0x10))
        // Alineación default: centro (igual que los tickets actuales).
        out.write(byteArrayOf(0x1B, 0x61, 0x01))

        for (bl in blocks) {
            when (bl) {
                is PrintBlock.Text -> {
                    if (bl.line.isBlank()) continue
                    out.write(byteArrayOf(0x1B, 0x61, bl.align.coerceIn(0, 2).toByte()))
                    out.write(byteArrayOf(0x1B, 0x45, if (bl.bold) 0x01 else 0x00))
                    out.write(byteArrayOf(0x1D, 0x21, sizeByte(bl.size)))
                    out.write(bl.line.toByteArray(cp1252))
                    out.write(0x0A)
                }
                is PrintBlock.Qr -> {
                    if (bl.content.isBlank()) continue
                    out.write(byteArrayOf(0x1B, 0x61, 0x01))
                    writeQr(out, bl.content)
                    out.write(0x0A)
                }
                is PrintBlock.Image -> {
                    val raster = Escudo.toMonoRaster(bl.bitmap) ?: continue
                    out.write(byteArrayOf(0x1B, 0x61, 0x01))
                    writeRaster(out, raster)
                    out.write(0x0A)
                }
                PrintBlock.Line -> {
                    out.write(byteArrayOf(0x1B, 0x61, 0x01))
                    out.write(byteArrayOf(0x1B, 0x45, 0x00))
                    out.write(byteArrayOf(0x1D, 0x21, 0x00))
                    out.write(SEP.toByteArray(cp1252))
                    out.write(0x0A)
                }
                PrintBlock.Feed -> {
                    out.write(0x0A)
                    out.write(0x0A)
                }
            }
        }

        out.write(0x0A)
        out.write(0x0A)
        out.write(0x0A)
        // Corte (las sin cutter lo ignoran).
        out.write(byteArrayOf(0x1D, 0x56, 0x00))
        return out.toByteArray()
    }

    /**
     * GS ! n: aproxima los tamaños Sunmi (px a 203dpi) a magnificación
     * ESC/POS. 24px ≈ fuente normal, 48px (XL) ≈ doble.
     */
    private fun sizeByte(size: Float): Byte = when {
        size >= 48f -> 0x11
        size >= 28f -> 0x01
        else -> 0x00
    }.toByte()

    /** QR Model 2, tamaño 6, corrección L. Datos en UTF-8. */
    private fun writeQr(out: ByteArrayOutputStream, content: String) {
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00))
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06))
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30))
        val data = content.toByteArray(Charsets.UTF_8)
        val len = data.size + 3
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, (len and 0xFF).toByte(), ((len shr 8) and 0xFF).toByte(), 0x31, 0x50, 0x30))
        out.write(data)
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
    }

    /** `GS v 0 m=0` (raster normal). */
    private fun writeRaster(out: ByteArrayOutputStream, raster: Escudo.MonoRaster) {
        val wBytes = (raster.widthPx + 7) / 8
        val h = raster.heightPx
        out.write(
            byteArrayOf(
                0x1D, 0x76, 0x30, 0x00,
                (wBytes and 0xFF).toByte(), ((wBytes shr 8) and 0xFF).toByte(),
                (h and 0xFF).toByte(), ((h shr 8) and 0xFF).toByte(),
            ),
        )
        out.write(raster.bytes)
    }
}

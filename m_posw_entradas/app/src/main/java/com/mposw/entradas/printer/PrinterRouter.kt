package com.mposw.entradas.printer

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.widget.Toast
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.StatusPayload
import com.mposw.entradas.data.TemplateElement
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Elige el backend de impresión automáticamente (sin ajustes de "tipo de
 * equipo"): si el equipo trae el servicio de impresión Sunmi se usa el
 * AIDL integrado; si no, la impresora Bluetooth configurada en Ajustes.
 */
object PrinterRouter {
    @Volatile private var cachedSunmi: Boolean? = null

    fun isSunmiDevice(ctx: Context): Boolean {
        cachedSunmi?.let { return it }
        val pm = ctx.packageManager
        val found = listOf("woyou.aidlservice.jiuiv5", "com.sunmi.peripheral.printer").any { pkg ->
            try {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(pkg, 0)
                true
            } catch (_: PackageManager.NameNotFoundException) {
                false
            } catch (_: Exception) {
                false
            }
        }
        cachedSunmi = found
        return found
    }

    /** Texto para la sección Impresora en Configuración. */
    fun describe(ctx: Context): String {
        if (isSunmiDevice(ctx)) return "Integrada del equipo (Sunmi)"
        val session = SessionManager(ctx)
        val name = session.printerName.trim()
        val mac = session.printerMac.trim()
        if (mac.isEmpty()) return "Bluetooth: sin impresora elegida"
        return "Bluetooth: ${name.ifBlank { mac }}"
    }

    suspend fun printSale(
        ctx: Context,
        payload: StatusPayload,
        elements: List<TemplateElement>,
        escudo: Bitmap?,
    ): Result<Unit> {
        if (isSunmiDevice(ctx)) {
            return SunmiPrinter.printSale(ctx, payload, elements, escudo)
        }
        return try {
            val blocks = mutableListOf<PrintBlock>()
            val codigos = (payload.codigos ?: emptyList()).ifEmpty { listOf("") }
            for ((idx, codigo) in codigos.withIndex()) {
                blocks += EntradasBlockBuilder.ticketBlocks(payload, codigo, elements, escudo)
                if (idx < codigos.size - 1) {
                    blocks.add(PrintBlock.Feed)
                    blocks.add(PrintBlock.Line)
                }
            }
            blocks.add(PrintBlock.Feed)
            blocks.add(PrintBlock.Feed)
            val res = BluetoothPrinter.printBlocks(ctx, blocks)
            if (res.isFailure) toastGuardado(ctx)
            res
        } catch (e: Exception) {
            toastGuardado(ctx)
            Result.failure(e)
        }
    }

    suspend fun printBlocks(ctx: Context, escudo: Bitmap?, blocks: List<PrintBlock>): Result<Unit> {
        if (isSunmiDevice(ctx)) {
            return SunmiPrinter.printBlocks(ctx, escudo, blocks)
        }
        return try {
            val all = mutableListOf<PrintBlock>()
            escudo?.let { all.add(PrintBlock.Image(it)) }
            all += blocks
            val res = BluetoothPrinter.printBlocks(ctx, all)
            if (res.isFailure) toastGuardado(ctx)
            res
        } catch (e: Exception) {
            toastGuardado(ctx)
            Result.failure(e)
        }
    }

    private suspend fun toastGuardado(ctx: Context) = withContext(Dispatchers.Main) {
        try {
            Toast.makeText(ctx, "Impresora no lista. Venta guardada para reimprimir.", Toast.LENGTH_LONG).show()
        } catch (_: Exception) {
        }
    }
}

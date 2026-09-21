package com.mposw.entradas.printer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.Toast
import com.mposw.entradas.data.StatusPayload
import com.mposw.entradas.data.TemplateElement
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import com.sunmi.peripheral.printer.WoyouConsts
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Impresora integrada Sunmi V2s vía API AIDL de bajo nivel
 * (com.sunmi:printerlibrary:1.0.15 solo expone
 * com.sunmi.peripheral.printer.* — verificado contra el AAR).
 *
 * Firmas usadas (InnerResultCallback en todas las async):
 * - printText(String, cb) / printBitmap(Bitmap, cb)
 * - printQRCode(String, modulesize, errorlevel, cb)
 * - setAlignment(int 0/1/2, cb) / setFontSize(float, cb)
 * - setPrinterStyle(ENABLE_BOLD, ENABLE|DISABLE) — sincrónica
 * - lineWrap(int, cb) / cutPaper(cb)
 */
object SunmiPrinter {
    private const val OP_TIMEOUT_MS = 8000L
    private const val BIND_WAIT_MS = 3000L

    @Volatile private var service: SunmiPrinterService? = null

    private val conn = object : InnerPrinterCallback() {
        override fun onConnected(s: SunmiPrinterService) {
            service = s
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun init(ctx: Context) {
        bind(ctx)
    }

    fun isReady(): Boolean = service != null

    private fun bind(ctx: Context) {
        try {
            InnerPrinterManager.getInstance().bindService(ctx.applicationContext, conn)
        } catch (_: Exception) {
        }
    }

    private suspend fun ensureService(ctx: Context): SunmiPrinterService? {
        service?.let { return it }
        bind(ctx)
        var waited = 0L
        while (service == null && waited < BIND_WAIT_MS) {
            delay(100)
            waited += 100
        }
        return service
    }

    private val noopCb = object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String) {}
        override fun onRaiseException(code: Int, msg: String) {}
        override fun onPrintResult(code: Int, msg: String) {}
    }

    private suspend fun awaitOp(call: (InnerResultCallback) -> Unit): Boolean {
        return try {
            withTimeout(OP_TIMEOUT_MS) {
                suspendCancellableCoroutine { cont ->
                    val cb = object : InnerResultCallback() {
                        override fun onRunResult(isSuccess: Boolean) {
                            if (!cont.isActive) return
                            if (isSuccess) cont.resume(Unit)
                            else cont.resumeWithException(PrinterException("printer error"))
                        }

                        override fun onReturnString(result: String) {}

                        override fun onRaiseException(code: Int, msg: String) {
                            if (cont.isActive) cont.resumeWithException(PrinterException("[$code] $msg"))
                        }

                        override fun onPrintResult(code: Int, msg: String) {}
                    }
                    try {
                        call(cb)
                    } catch (e: Exception) {
                        if (cont.isActive) cont.resumeWithException(e)
                    }
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun alignOf(align: String?): Int = when (align) {
        "left" -> 0
        "right" -> 2
        else -> 1
    }

    private fun sizeOf(size: String?): Float = when (size) {
        "XL" -> 48f
        "L" -> 36f
        "M" -> 28f
        else -> 24f
    }

    fun escudoBitmap(base64Png: String): Bitmap? {
        if (base64Png.isBlank()) return null
        return try {
            val bytes = Base64.decode(base64Png, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    suspend fun printSale(
        ctx: Context,
        payload: StatusPayload,
        elements: List<TemplateElement>,
        escudo: Bitmap?,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val svc = ensureService(ctx) ?: throw PrinterException("Impresora no disponible")
            val codigos = payload.codigos.ifEmpty { listOf("") }
            for ((idx, codigo) in codigos.withIndex()) {
                val vars = TicketRenderer.varsFor(payload, codigo)
                for (el in elements) {
                    val ok = when (el.type) {
                        "logo" -> {
                            if (escudo == null) true
                            else {
                                svc.setAlignment(1, noopCb)
                                awaitOp { svc.printBitmap(escudo, it) }
                            }
                        }
                        "text" -> {
                            val line = TicketRenderer.render(el.value, vars)
                            if (line.isBlank()) true
                            else {
                                svc.setAlignment(alignOf(el.align), noopCb)
                                svc.setFontSize(sizeOf(el.size), noopCb)
                                try {
                                    svc.setPrinterStyle(
                                        WoyouConsts.ENABLE_BOLD,
                                        if (el.bold) WoyouConsts.ENABLE else WoyouConsts.DISABLE,
                                    )
                                } catch (_: Exception) {
                                }
                                awaitOp { svc.printText("$line\n", it) }
                            }
                        }
                        "qr" -> {
                            val content = TicketRenderer.render(el.value, vars)
                            if (content.isBlank()) true
                            else {
                                svc.setAlignment(1, noopCb)
                                awaitOp { svc.printQRCode(content, 6, 1, it) } &&
                                    awaitOp { svc.printText("\n", it) }
                            }
                        }
                        "line" -> awaitOp { svc.printText("--------------------------------\n", it) }
                        "spacer" -> awaitOp { svc.lineWrap(1, it) }
                        else -> true
                    }
                    if (!ok) throw PrinterException("Fallo de impresión")
                }
                if (idx < codigos.size - 1) {
                    if (!awaitOp { svc.printText("--------------------------------\n", it) }) {
                        throw PrinterException("Fallo de impresión")
                    }
                }
            }
            if (!awaitOp { svc.lineWrap(2, it) }) throw PrinterException("Fallo de impresión")
            if (!awaitOp { svc.cutPaper(it) }) throw PrinterException("Fallo de impresión")
            Result.success(Unit)
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                Toast.makeText(
                    ctx,
                    "Sin papel o impresora no lista: ${e.message}. Guardado para reimprimir.",
                    Toast.LENGTH_LONG,
                ).show()
            }
            Result.failure(e)
        }
    }

    class PrinterException(message: String) : RuntimeException(message)
}

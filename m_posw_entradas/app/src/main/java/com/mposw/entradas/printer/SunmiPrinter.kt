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
import kotlinx.coroutines.withContext

object SunmiPrinter {
    @Volatile private var service: SunmiPrinterService? = null
    @Volatile private var bound = false
    @Volatile private var appCtx: Context? = null

    private val noop = object : InnerResultCallback() {
        override fun onRunResult(success: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(code: Int, msg: String?) {}
        override fun onPrintResult(code: Int, msg: String?) {}
    }

    private val connection = object : InnerPrinterCallback() {
        protected override fun onConnected(svc: SunmiPrinterService) {
            service = svc
            bound = true
            try {
                svc.printerInit(noop)
            } catch (_: Exception) {
            }
        }

        protected override fun onDisconnected() {
            service = null
            bound = false
        }
    }

    fun init(ctx: Context) {
        try {
            val app = ctx.applicationContext
            appCtx = app
            if (service == null) {
                InnerPrinterManager.getInstance().bindService(app, connection)
            }
            bound = true
        } catch (_: Exception) {
            bound = false
        }
    }

    private suspend fun requireService(): SunmiPrinterService {
        var svc = service
        if (svc == null) {
            appCtx?.let { ctx ->
                try {
                    InnerPrinterManager.getInstance().bindService(ctx, connection)
                } catch (_: Exception) {
                }
            }
            for (i in 0 until 30) {
                delay(100)
                svc = service
                if (svc != null) break
            }
        }
        return svc ?: throw IllegalStateException("Impresora no conectada")
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

    private fun textSize(size: String?): Int = when (size) {
        "XL" -> 48
        "L" -> 36
        "M" -> 28
        else -> 24
    }

    suspend fun printSale(
        ctx: Context,
        payload: StatusPayload,
        elements: List<TemplateElement>,
        escudo: Bitmap?,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val printer = requireService()
            val codigos = payload.codigos.ifEmpty { listOf("") }
            for ((idx, codigo) in codigos.withIndex()) {
                val vars = TicketRenderer.varsFor(payload, codigo)
                for (el in elements) {
                    when (el.type) {
                        "logo" -> {
                            printer.setAlignment(1, noop)
                            escudo?.let { printer.printBitmap(it, noop) }
                        }
                        "text" -> {
                            val line = TicketRenderer.render(el.value, vars)
                            if (line.isNotBlank()) {
                                printer.setFontSize(textSize(el.size).toFloat(), noop)
                                printer.setPrinterStyle(
                                    WoyouConsts.ENABLE_BOLD,
                                    if (el.bold) WoyouConsts.ENABLE else WoyouConsts.DISABLE,
                                )
                                printer.setAlignment(1, noop)
                                printer.printText("$line\n", noop)
                            }
                        }
                        "qr" -> {
                            val content = TicketRenderer.render(el.value, vars)
                            if (content.isNotBlank()) {
                                printer.setAlignment(1, noop)
                                printer.printQRCode(content, 6, 1, noop)
                                printer.printText("\n", noop)
                            }
                        }
                        "line" -> printer.printText("--------------------------------\n", noop)
                        "spacer" -> printer.lineWrap(2, noop)
                    }
                }
                if (idx < codigos.size - 1) {
                    printer.lineWrap(2, noop)
                    printer.printText("--------------------------------\n", noop)
                }
            }
            printer.lineWrap(2, noop)
            printer.lineWrap(2, noop)
            printer.cutPaper(noop)
            Result.success(Unit)
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                Toast.makeText(ctx, "Sin papel o impresora no lista: ${e.message}. Guardado para reimprimir.", Toast.LENGTH_LONG).show()
            }
            Result.failure(e)
        }
    }
}

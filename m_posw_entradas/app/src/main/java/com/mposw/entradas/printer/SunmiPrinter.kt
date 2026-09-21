package com.mposw.entradas.printer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.Toast
import com.mposw.entradas.data.StatusPayload
import com.mposw.entradas.data.TemplateElement
import com.sunmi.printerlibrary.api.SunmiPrintHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object SunmiPrinter {
    @Volatile private var bound = false

    fun init(ctx: Context) {
        try {
            SunmiPrintHelper.getInstance().initSunmiPrinterService(ctx.applicationContext)
            bound = true
        } catch (_: Exception) {
            bound = false
        }
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
            val helper = SunmiPrintHelper.getInstance()
            val codigos = payload.codigos.ifEmpty { listOf("") }
            for ((idx, codigo) in codigos.withIndex()) {
                val vars = TicketRenderer.varsFor(payload, codigo)
                for (el in elements) {
                    when (el.type) {
                        "logo" -> escudo?.let { helper.printBitmap(it, 1) }
                        "text" -> {
                            val line = TicketRenderer.render(el.value, vars)
                            if (line.isNotBlank()) {
                                helper.setFontSize(textSize(el.size))
                                helper.setBold(el.bold)
                                helper.setAlign(1)
                                helper.printText("$line\n")
                            }
                        }
                        "qr" -> {
                            val content = TicketRenderer.render(el.value, vars)
                            if (content.isNotBlank()) {
                                helper.setAlign(1)
                                helper.printQr(content, 6, 1)
                                helper.printText("\n")
                            }
                        }
                        "line" -> helper.printText("--------------------------------\n")
                        "spacer" -> helper.feedPaper()
                    }
                }
                if (idx < codigos.size - 1) {
                    helper.feedPaper()
                    helper.printText("--------------------------------\n")
                }
            }
            helper.feedPaper()
            helper.feedPaper()
            helper.cutpaper()
            Result.success(Unit)
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                Toast.makeText(ctx, "Sin papel o impresora no lista: ${e.message}. Guardado para reimprimir.", Toast.LENGTH_LONG).show()
            }
            Result.failure(e)
        }
    }
}

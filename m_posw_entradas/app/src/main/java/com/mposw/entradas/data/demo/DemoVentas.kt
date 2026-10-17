package com.mposw.entradas.data.demo

import com.mposw.entradas.data.DatosTicket
import com.mposw.entradas.data.FixtureVigente
import com.mposw.entradas.data.StatusPayload
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Modo prueba: catálogo ficticio y ventas 100% locales para enseñar
 * y probar el flujo de impresión. No toca red (salvo lecturas de
 * template/escudo ya cacheadas), no numera de verdad y no persiste nada:
 * todo vive en memoria y se descarta al salir del modo.
 */
object DemoVentas {
    const val PARTIDO_ID = "demo-partido"
    const val EVENTO_ID = "demo-evento"

    private var vendidosL = 12
    private var vendidosV = 8
    private var vendidosEvento = 5

    private fun hoy(): String {
        val out = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        out.timeZone = TimeZone.getTimeZone("America/Argentina/Buenos_Aires")
        return out.format(Date())
    }

    private fun isoAhora(): String {
        val out = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        out.timeZone = TimeZone.getTimeZone("UTC")
        return out.format(Date())
    }

    private fun isoOffset(horas: Int): String {
        val out = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        out.timeZone = TimeZone.getTimeZone("UTC")
        return out.format(Date(System.currentTimeMillis() + horas * 3_600_000L))
    }

    fun catalog(): List<FixtureVigente> = listOf(
        FixtureVigente(
            fixtureId = PARTIDO_ID,
            tipo = "PARTIDO",
            fecha = hoy(),
            torneo = "Torneo Prueba",
            torneoId = "demo-torneo",
            rival = "Rival Prueba",
            rivalId = "demo-rival",
            precio = "1000",
            vendidosL = vendidosL,
            vendidosV = vendidosV,
            ventanaDesde = isoOffset(-2),
            ventanaHasta = isoOffset(6),
        ),
        FixtureVigente(
            eventoId = EVENTO_ID,
            tipo = "EVENTO",
            titulo = "Evento de prueba",
            fecha = hoy(),
            precio = "500",
            vendidos = vendidosEvento,
            ventanaDesde = isoOffset(-2),
            ventanaHasta = isoOffset(6),
        ),
    )

    private fun pad3(n: Int) = n.toString().padStart(3, '0')

    /** Avanza los contadores en memoria y devuelve los códigos generados. */
    fun vender(esEvento: Boolean, sector: String, cantidad: Int): List<String> {
        if (esEvento) {
            val desde = vendidosEvento + 1
            vendidosEvento += cantidad
            return (desde until desde + cantidad).map { "E-${pad3(it)}" }
        }
        val prefix = if (sector == "LOCAL") "L" else "V"
        val desde = (if (sector == "LOCAL") vendidosL else vendidosV) + 1
        if (sector == "LOCAL") vendidosL += cantidad else vendidosV += cantidad
        return (desde until desde + cantidad).map { "$prefix-${pad3(it)}" }
    }

    /** Payload aprobado ficticio con el template REAL (va por templateId). */
    fun payload(
        esEvento: Boolean,
        sector: String,
        cantidad: Int,
        precio: Double,
        club: String,
        templateId: String?,
        templateVersion: Int,
        logoVersion: Int,
    ): StatusPayload {
        val codigos = vender(esEvento, sector, cantidad)
        val precioStr = "%.2f".format(Locale.US, precio)
        val totalStr = "%.2f".format(Locale.US, precio * cantidad)
        val ahora = isoAhora()
        return StatusPayload(
            saleId = "demo-${System.currentTimeMillis()}",
            status = "APPROVED",
            tipo = if (esEvento) "EVENTO" else "PARTIDO",
            eventoId = if (esEvento) EVENTO_ID else null,
            codigos = codigos,
            cantidad = cantidad,
            precioUnit = precioStr,
            descuento = "0.00",
            total = totalStr,
            paymentMethod = "CASH",
            datos = DatosTicket(
                club = club,
                torneo = if (esEvento) "" else "Torneo Prueba",
                rival = if (esEvento) "" else "Rival Prueba",
                evento = if (esEvento) "Evento de prueba" else "",
                fecha = hoy(),
                sector = sector,
                ventaId = "demo",
                fechaPago = ahora,
                footer = "SIN VALIDEZ · PRUEBA",
                qrImageUrl = null,
            ),
            qrImageUrl = null,
            templateId = templateId,
            templateVersion = templateVersion,
            logoVersion = logoVersion,
            beneficios = emptyList(),
        )
    }
}

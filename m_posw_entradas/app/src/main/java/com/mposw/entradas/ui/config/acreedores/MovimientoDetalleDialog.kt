package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.DialogMovimientoDetalleBinding
import com.mposw.entradas.util.DialogStyle
import com.mposw.entradas.util.MoneyFormat
import java.text.SimpleDateFormat
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * Detalle de un movimiento: arriba fecha y hora; en fiados el detalle
 * de productos comprados (traído de la venta); siempre el saldo.
 */
class MovimientoDetalleDialog : DialogFragment() {
    companion object {
        fun new(m: AcreedorDetalleDialog.MovUi): MovimientoDetalleDialog {
            val d = MovimientoDetalleDialog()
            d.arguments = Bundle().apply {
                putString("kind", m.kind)
                putString("fechaIso", m.fechaIso)
                putDouble("montoSigned", m.montoSigned)
                putDouble("saldoTras", m.saldoTras)
                putString("ventaId", m.ventaId)
                putString("descripcion", m.descripcion)
                putString("notas", m.notas)
            }
            return d
        }
    }

    private var _b: DialogMovimientoDetalleBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogMovimientoDetalleBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        DialogStyle.capWidth(this)
        DialogStyle.round(dialog?.window)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val args = requireArguments()
        val kind = args.getString("kind").orEmpty()
        val fechaIso = args.getString("fechaIso").orEmpty()
        val monto = args.getDouble("montoSigned", 0.0)
        val saldoTras = args.getDouble("saldoTras", 0.0)
        val ventaId = args.getString("ventaId")
        b.tvMovDetalleTitulo.text = fmtFecha(fechaIso)
        b.btnMovDetalleCerrar.setOnClickListener { dismissAllowingStateLoss() }
        if (kind == "venta" && !ventaId.isNullOrBlank()) {
            b.tvMovDetalleCuerpo.text = "Cargando productos…"
            lifecycleScope.launch {
                try {
                    val sale = PosSalesRepo(requireContext(), SessionManager(requireContext())).sale(ventaId)
                    if (!isAdded) return@launch
                    val lines = (sale.items ?: emptyList())
                        .filter { !(it.product?.name ?: "").isBlank() }
                        .map { i ->
                            val qty = i.quantity
                            val name = i.product?.name.orEmpty()
                            val sub = i.subtotal?.toDoubleOrNull() ?: 0.0
                            "$qty × $name — ${MoneyFormat.format(sub)}"
                        }
                    val cuerpo = StringBuilder()
                    if (lines.isEmpty()) cuerpo.append("Fiado por ${MoneyFormat.format(monto)}\n")
                    else {
                        lines.forEach { cuerpo.append(it).append('\n') }
                    }
                    cuerpo.append("\nTotal: ${MoneyFormat.format(kotlin.math.abs(monto))}\n")
                    cuerpo.append("Saldo: ${MoneyFormat.format(saldoTras)}")
                    b.tvMovDetalleCuerpo.text = cuerpo.toString()
                } catch (e: Exception) {
                    if (!isAdded) return@launch
                    b.tvMovDetalleCuerpo.text =
                        "Fiado por ${MoneyFormat.format(kotlin.math.abs(monto))}\nSaldo: ${MoneyFormat.format(saldoTras)}\n\n(${ApiClient.parseError(e)})"
                }
            }
        } else {
            val abs = kotlin.math.abs(monto)
            b.tvMovDetalleCuerpo.text = when (kind) {
                "pago" -> buildString {
                    append("Pago por ${MoneyFormat.format(abs)}\n")
                    val notas = args.getString("notas")?.trim().orEmpty()
                    if (notas.isNotEmpty()) append("Notas: $notas\n")
                    append("Saldo: ${MoneyFormat.format(saldoTras)}")
                }
                else -> buildString {
                    append("Ajuste por ${MoneyFormat.format(abs)}\n")
                    val desc = args.getString("descripcion")?.trim().orEmpty()
                    if (desc.isNotEmpty()) append("Detalle: $desc\n")
                    append("Saldo: ${MoneyFormat.format(saldoTras)}")
                }
            }
        }
    }

    private fun fmtFecha(iso: String): String {
        if (iso.isBlank()) return "--"
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd",
        )
        var t = 0L
        for (p in patterns) {
            try {
                t = SimpleDateFormat(p, Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.parse(iso)?.time ?: 0L
                if (t != 0L) break
            } catch (_: Exception) {}
        }
        if (t == 0L) return iso
        return try {
            SimpleDateFormat("dd/MM/yyyy - HH:mm", Locale("es", "AR")).format(java.util.Date(t))
        } catch (_: Exception) {
            iso
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

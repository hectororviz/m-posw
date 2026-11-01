package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.DialogAcreedorDetalleBinding
import com.mposw.entradas.databinding.ItemAcreedorMovimientoBinding
import com.mposw.entradas.util.DialogStyle
import com.mposw.entradas.util.MoneyFormat
import java.text.SimpleDateFormat
import java.util.Locale
import kotlinx.coroutines.launch

/**
 * Detalle: saldo actual + últimos movimientos (tap = detalle) +
 * botón para registrar pago. Solo lectura salvo el pago.
 */
class AcreedorDetalleDialog : DialogFragment() {
    private var _b: DialogAcreedorDetalleBinding? = null
    private val b get() = _b!!
    private var acreedorId: Int = 0
    private var acreedorNombre: String = ""
    private val adapter = MovAdapter { openMovDetalle(it) }

    companion object {
        fun new(id: Int, nombre: String): AcreedorDetalleDialog {
            val d = AcreedorDetalleDialog()
            d.arguments = Bundle().apply {
                putInt("id", id)
                putString("nombre", nombre)
            }
            return d
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acreedorId = arguments?.getInt("id", 0) ?: 0
        acreedorNombre = arguments?.getString("nombre").orEmpty()
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogAcreedorDetalleBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        DialogStyle.capWidth(this)
        DialogStyle.round(dialog?.window)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.tvDetalleNombre.text = acreedorNombre.ifEmpty { "Acreedor" }
        b.rvMovimientos.layoutManager = LinearLayoutManager(requireContext())
        b.rvMovimientos.adapter = adapter
        b.btnDetalleCerrar.setOnClickListener { dismissAllowingStateLoss() }
        b.btnDetallePagar.setOnClickListener {
            AcreedorPagoDialog.new(acreedorId, acreedorNombre)
                .show(childFragmentManager, "acreedor-pago")
        }
        load()
    }

    fun onPagoRegistrado() {
        load()
        (parentFragment as? ConfigAcreedoresFragment)?.reload()
    }

    private fun load() {
        b.tvDetalleError.text = ""
        lifecycleScope.launch {
            try {
                val repo = PosSalesRepo(requireContext(), SessionManager(requireContext()))
                val d = repo.deuda(acreedorId)
                if (!isAdded) return@launch
                val saldo = d.saldoPendiente ?: 0.0
                val favor = d.saldoFavor ?: 0.0
                b.tvDetalleSaldo.text = if (favor > 0) {
                    "A favor: ${MoneyFormat.format(favor)}"
                } else {
                    "Deuda actual: ${MoneyFormat.format(saldo)}"
                }
                b.tvDetalleEstado.text = when (d.estadoDeuda) {
                    "LIMITE" -> "Límite superado"
                    "ADVERTENCIA" -> "Supera la advertencia"
                    else -> ""
                }
                adapter.set(buildMovs(d))
            } catch (e: Exception) {
                if (!isAdded) return@launch
                if (ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                b.tvDetalleError.text = ApiClient.parseError(e)
            }
        }
    }

    private data class MovUi(
        val kind: String,
        val titulo: String,
        val fechaIso: String,
        val montoSigned: Double,
        val detalle: String,
    )

    private fun buildMovs(d: com.mposw.entradas.data.PosAcreedorDeuda): List<MovUi> {
        val out = mutableListOf<MovUi>()
        d.fiadoVentas.orEmpty().forEach { v ->
            val monto = v.monto ?: 0.0
            val fecha = v.createdAt.orEmpty()
            out.add(
                MovUi(
                    kind = "venta",
                    titulo = "Fiado${if (v.ventaId.isNullOrBlank()) "" else " · ${v.ventaId}"}",
                    fechaIso = fecha,
                    montoSigned = monto,
                    detalle = "Fiado por ${MoneyFormat.format(monto)}\n" +
                        "Fecha: ${fmtFecha(fecha)}\n" +
                        (if (v.ventaId.isNullOrBlank()) "" else "Venta: ${v.ventaId}\n") +
                        "Saldo restante: ${MoneyFormat.format(v.saldoRestante ?: 0.0)}",
                ),
            )
        }
        d.ajustes.orEmpty().forEach { a ->
            val monto = a.monto ?: 0.0
            val fecha = a.fecha.orEmpty()
            out.add(
                MovUi(
                    kind = "ajuste",
                    titulo = "Ajuste${if (a.descripcion.isNullOrBlank()) "" else " · ${a.descripcion}"}",
                    fechaIso = fecha,
                    montoSigned = monto,
                    detalle = "Ajuste por ${MoneyFormat.format(monto)}\n" +
                        "Fecha: ${fmtFecha(fecha)}\n" +
                        (if (a.descripcion.isNullOrBlank()) "" else "Detalle: ${a.descripcion}\n") +
                        "Saldo restante: ${MoneyFormat.format(a.saldoRestante ?: 0.0)}",
                ),
            )
        }
        d.pagos.orEmpty().forEach { p ->
            val monto = p.monto ?: 0.0
            val fecha = p.fecha.orEmpty().ifEmpty { p.createdAt.orEmpty() }
            out.add(
                MovUi(
                    kind = "pago",
                    titulo = "Pago en efectivo",
                    fechaIso = fecha,
                    montoSigned = -monto,
                    detalle = "Pago por ${MoneyFormat.format(monto)}\n" +
                        "Fecha: ${fmtFecha(fecha)}\n" +
                        (if (p.notas.isNullOrBlank()) "" else "Notas: ${p.notas}\n"),
                ),
            )
        }
        return out.sortedWith(
            compareByDescending<MovUi> { timeOf(it.fechaIso) }.thenByDescending { it.montoSigned },
        )
    }

    private fun timeOf(iso: String): Long {
        if (iso.isBlank()) return 0L
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd",
        )
        for (p in patterns) {
            try {
                val sdf = SimpleDateFormat(p, Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                return sdf.parse(iso)?.time ?: 0L
            } catch (_: Exception) {}
        }
        return 0L
    }

    private fun fmtFecha(iso: String): String {
        val t = timeOf(iso)
        if (t == 0L) return iso.ifEmpty { "--" }
        return try {
            SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("es", "AR")).format(java.util.Date(t))
        } catch (_: Exception) {
            iso
        }
    }

    private fun openMovDetalle(m: MovUi) {
        MovimientoDetalleDialog.new(m.titulo, "${fmtFecha(m.fechaIso)}\n\n${m.detalle}")
            .show(childFragmentManager, "mov-detalle")
    }

    private inner class MovAdapter(val onPick: (MovUi) -> Unit) : RecyclerView.Adapter<MovAdapter.Holder>() {
        private var items: List<MovUi> = emptyList()
        fun set(v: List<MovUi>) {
            items = v
            notifyDataSetChanged()
        }

        inner class Holder(val b: ItemAcreedorMovimientoBinding) : RecyclerView.ViewHolder(b.root) {
            init {
                b.root.setOnClickListener {
                    val i = bindingAdapterPosition
                    if (i >= 0 && i < items.size) onPick(items[i])
                }
            }
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
            Holder(ItemAcreedorMovimientoBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val m = items[position]
            h.b.tvMovTitulo.text = m.titulo
            h.b.tvMovFecha.text = fmtFecha(m.fechaIso)
            val abs = kotlin.math.abs(m.montoSigned)
            h.b.tvMovMonto.text = (if (m.montoSigned < 0) "− " else "+ ") + MoneyFormat.format(abs)
            h.b.tvMovSigno.text = when (m.kind) {
                "pago" -> "−"
                "ajuste" -> "±"
                else -> "+"
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

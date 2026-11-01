package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.R
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
 * botones fijos abajo: Imprimir, Registrar pago y Cerrar.
 */
class AcreedorDetalleDialog : DialogFragment() {
    private var _b: DialogAcreedorDetalleBinding? = null
    private val b get() = _b!!
    private var acreedorId: Int = 0
    private var acreedorNombre: String = ""
    private val adapter = MovAdapter { openMovDetalle(it) }
    private var movs: List<MovUi> = emptyList()

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
        dialog?.window?.let { w ->
            // Ancho: tope 720dp en tablets; alto 90% para lista con scroll
            // y botones siempre visibles.
            w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            DialogStyle.capWidth(this, 720)
            val lp = w.attributes
            lp.height = (resources.displayMetrics.heightPixels * 0.9).toInt()
            w.attributes = lp
            DialogStyle.round(w)
        }
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
        b.btnDetalleImprimir.setOnClickListener { imprimir() }
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
                movs = buildMovs(d)
                adapter.set(movs)
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

    private fun imprimir() {
        if (movs.isEmpty()) {
            Toast.makeText(requireContext(), "Sin movimientos para imprimir", Toast.LENGTH_SHORT).show()
        }
        b.btnDetalleImprimir.isEnabled = false
        lifecycleScope.launch {
            try {
                val ok = AcreedorTicketRenderer.print(
                    requireContext(), acreedorNombre, movs,
                    b.tvDetalleSaldo.text?.toString().orEmpty(),
                )
                if (isAdded && !ok) {
                    Toast.makeText(requireContext(), "No se pudo imprimir. Revisá la impresora en Config.", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                if (isAdded) Toast.makeText(requireContext(), ApiClient.parseError(e), Toast.LENGTH_LONG).show()
            } finally {
                if (isAdded) b.btnDetalleImprimir.isEnabled = true
            }
        }
    }

    data class MovUi(
        val kind: String,
        val fechaIso: String,
        val montoSigned: Double,
        val saldoTras: Double,
        val ventaId: String?,
        val descripcion: String?,
        val notas: String?,
    )

    private fun buildMovs(d: com.mposw.entradas.data.PosAcreedorDeuda): List<MovUi> {
        val out = mutableListOf<MovUi>()
        d.fiadoVentas.orEmpty().forEach { v ->
            out.add(
                MovUi(
                    kind = "venta",
                    fechaIso = v.createdAt.orEmpty(),
                    montoSigned = v.monto ?: 0.0,
                    saldoTras = 0.0,
                    ventaId = v.ventaId,
                    descripcion = null,
                    notas = null,
                ),
            )
        }
        d.ajustes.orEmpty().forEach { a ->
            out.add(
                MovUi(
                    kind = "ajuste",
                    fechaIso = a.fecha.orEmpty(),
                    montoSigned = a.monto ?: 0.0,
                    saldoTras = 0.0,
                    ventaId = null,
                    descripcion = a.descripcion,
                    notas = null,
                ),
            )
        }
        d.pagos.orEmpty().forEach { p ->
            out.add(
                MovUi(
                    kind = "pago",
                    fechaIso = p.fecha.orEmpty().ifEmpty { p.createdAt.orEmpty() },
                    montoSigned = -(p.monto ?: 0.0),
                    saldoTras = 0.0,
                    ventaId = null,
                    descripcion = null,
                    notas = p.notas,
                ),
            )
        }
        // Saldo corrido como la web: ascendente acumulando, se muestra desc.
        val asc = out.sortedBy { timeOf(it.fechaIso) }
        var running = 0.0
        val conSaldo = asc.map {
            running += it.montoSigned
            it.copy(saldoTras = Math.round(running * 100) / 100.0)
        }
        return conSaldo.sortedByDescending { timeOf(it.fechaIso) }
    }

    fun timeOf(iso: String): Long {
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

    fun fmtFecha(iso: String): String {
        val t = timeOf(iso)
        if (t == 0L) return iso.ifEmpty { "--" }
        return try {
            SimpleDateFormat("dd/MM/yyyy - HH:mm", Locale("es", "AR")).format(java.util.Date(t))
        } catch (_: Exception) {
            iso
        }
    }

    private fun openMovDetalle(m: MovUi) {
        MovimientoDetalleDialog.new(m).show(childFragmentManager, "mov-detalle")
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
            h.b.tvMovFecha.text = fmtFecha(m.fechaIso)
            val abs = kotlin.math.abs(m.montoSigned)
            val pago = m.montoSigned < 0
            h.b.tvMovMonto.text = (if (pago) "− " else "+ ") + MoneyFormat.format(abs)
            h.b.tvMovMonto.setTextColor(
                if (pago) ContextCompat.getColor(h.itemView.context, R.color.primary)
                else ContextCompat.getColor(h.itemView.context, R.color.on_surface),
            )
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

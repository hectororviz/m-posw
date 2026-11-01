package com.mposw.entradas.ui.config.acreedores

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SearchView
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.R
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.PosAcreedor
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.ItemPosAcreedorBinding
import com.mposw.entradas.databinding.TabConfigAcreedoresBinding
import com.mposw.entradas.ui.BrandApplier
import com.mposw.entradas.util.MoneyFormat
import kotlinx.coroutines.launch

/**
 * Solapa Acreedores (primera del engranaje en modo POS): lista completa
 * con búsqueda local, FAB + para alta mínima (solo nombre) y tap para
 * detalle (saldo + últimos movimientos + registrar pago).
 */
class ConfigAcreedoresFragment : Fragment() {
    private var _b: TabConfigAcreedoresBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager
    private lateinit var repo: PosSalesRepo
    private val adapter = AcreedorAdapter { openDetalle(it) }
    private var all: List<PosAcreedor> = emptyList()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = TabConfigAcreedoresBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        repo = PosSalesRepo(requireContext(), session)
        b.rvConfigAcreedores.layoutManager = LinearLayoutManager(requireContext())
        b.rvConfigAcreedores.adapter = adapter
        b.svAcreedores.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(q: String?): Boolean = false
            override fun onQueryTextChange(q: String?): Boolean {
                applyFilter(q.orEmpty())
                return true
            }
        })
        b.fabAcreedorAdd.setOnClickListener {
            AcreedorCrearDialog().show(childFragmentManager, "acreedor-crear")
        }
        load()
    }

    override fun onResume() {
        super.onResume()
        // Al volver del detalle/pago la lista puede estar desactualizada.
        if (_b != null && all.isNotEmpty()) load(silent = true)
    }

    fun reload() = load(silent = true)

    private fun applyFilter(q: String) {
        val needle = q.trim().lowercase()
        val filtered = if (needle.isEmpty()) all
        else all.filter { (it.nombre.orEmpty().lowercase().contains(needle)) }
        adapter.set(filtered)
        b.tvAcreedoresInfo.text = if (all.isEmpty()) "" else "${filtered.size} de ${all.size} acreedores"
    }

    private fun load(silent: Boolean = false) {
        if (!silent && isAdded) b.tvAcreedoresError.text = ""
        lifecycleScope.launch {
            try {
                val list = repo.acreedores().sortedBy { it.nombre.orEmpty().lowercase() }
                if (!isAdded) return@launch
                all = list
                applyFilter(b.svAcreedores.query?.toString().orEmpty())
                if (list.isEmpty()) b.tvAcreedoresInfo.text = "Sin acreedores"
            } catch (e: Exception) {
                if (!isAdded) return@launch
                if (ApiClient.isWrongMode(e)) {
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                b.tvAcreedoresError.text = ApiClient.parseError(e)
            }
        }
    }

    private fun openDetalle(a: PosAcreedor) {
        AcreedorDetalleDialog.new(a.id, a.nombre.orEmpty())
            .show(childFragmentManager, "acreedor-detalle")
    }

    private inner class AcreedorAdapter(val onPick: (PosAcreedor) -> Unit) :
        RecyclerView.Adapter<AcreedorAdapter.Holder>() {
        private var items: List<PosAcreedor> = emptyList()
        // Pastel del acento del club para la cebra (nulo = sin semilla).
        private var zebra: Int? = null
        private var zebraReady = false
        // Pill del badge por estado (se crean una vez con los colores del tema).
        private var pills: Map<String, GradientDrawable>? = null
        private var pillFg: Map<String, Int>? = null

        fun set(v: List<PosAcreedor>) {
            items = v
            notifyDataSetChanged()
        }

        private fun zebraColor(): Int? {
            if (!zebraReady && isAdded) {
                zebraReady = true
                zebra = try {
                    BrandApplier.parse(session.brandColor)?.first?.let {
                        ColorUtils.setAlphaComponent(it, 24)
                    }
                } catch (_: Exception) {
                    null
                }
            }
            return zebra
        }

        private fun pillFor(estado: String): Pair<GradientDrawable, Int> {
            val ctx = requireContext()
            if (pills == null) {
                val radius = 12 * ctx.resources.displayMetrics.density
                fun pill(bgRes: Int): GradientDrawable = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = radius
                    setColor(ContextCompat.getColor(ctx, bgRes))
                }
                pills = mapOf(
                    "OK" to pill(R.color.primary_container),
                    "AVISO" to pill(R.color.tertiary_container),
                    "LIMITE" to pill(R.color.error_container),
                )
                pillFg = mapOf(
                    "OK" to ContextCompat.getColor(ctx, R.color.on_primary_container),
                    "AVISO" to ContextCompat.getColor(ctx, R.color.on_tertiary_container),
                    "LIMITE" to ContextCompat.getColor(ctx, R.color.on_error_container),
                )
            }
            return (pills!![estado] ?: pills!!["OK"]!!) to (pillFg!![estado] ?: pillFg!!["OK"]!!)
        }

        inner class Holder(val b: ItemPosAcreedorBinding) : RecyclerView.ViewHolder(b.root) {
            init {
                b.root.setOnClickListener {
                    val i = bindingAdapterPosition
                    if (i >= 0 && i < items.size) onPick(items[i])
                }
            }
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
            Holder(ItemPosAcreedorBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val a = items[position]
            h.b.tvAcreedorName.text = a.nombre ?: ""
            val saldo = a.saldo ?: 0.0
            h.b.tvAcreedorSaldo.text = MoneyFormat.format(saldo)
            h.b.tvAcreedorSaldo.setTextColor(
                if (saldo < 0) ContextCompat.getColor(h.itemView.context, R.color.primary)
                else ContextCompat.getColor(h.itemView.context, R.color.on_surface),
            )
            val estado = when {
                a.limiteDeuda != null && saldo > a.limiteDeuda -> "LIMITE"
                a.advertenciaDeuda != null && saldo > a.advertenciaDeuda -> "AVISO"
                else -> "OK"
            }
            val (bg, fg) = pillFor(estado)
            h.b.tvAcreedorEstado.text = when (estado) {
                "LIMITE" -> "LÍMITE"
                "AVISO" -> "AVISO"
                else -> "OK"
            }
            h.b.tvAcreedorEstado.background = bg
            h.b.tvAcreedorEstado.setTextColor(fg)
            h.b.tvAcreedorEstado.contentDescription = "Estado: ${h.b.tvAcreedorEstado.text}"
            // Cebra pastel del acento en filas impares.
            h.b.root.setBackgroundColor(zebraColor()?.takeIf { position % 2 == 1 } ?: 0)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

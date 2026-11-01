package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SearchView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.PosAcreedor
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.ItemPosAcreedorBinding
import com.mposw.entradas.databinding.TabConfigAcreedoresBinding
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
        fun set(v: List<PosAcreedor>) {
            items = v
            notifyDataSetChanged()
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
            h.b.tvAcreedorSaldo.text = "Deuda: ${MoneyFormat.format(a.saldo ?: 0.0)}"
            val proyectado = a.saldo ?: 0.0
            when {
                a.limiteDeuda != null && proyectado > a.limiteDeuda -> {
                    h.b.tvAcreedorIcon.visibility = View.VISIBLE
                    h.b.tvAcreedorIcon.text = "⛔"
                    h.b.tvAcreedorIcon.contentDescription = "Límite superado"
                }
                a.advertenciaDeuda != null && proyectado > a.advertenciaDeuda -> {
                    h.b.tvAcreedorIcon.visibility = View.VISIBLE
                    h.b.tvAcreedorIcon.text = "⚠️"
                    h.b.tvAcreedorIcon.contentDescription = "Supera la advertencia"
                }
                else -> h.b.tvAcreedorIcon.visibility = View.GONE
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

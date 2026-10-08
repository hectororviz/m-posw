package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.data.PosAcreedor
import com.mposw.entradas.databinding.DialogPosFiadoBinding
import com.mposw.entradas.databinding.ItemPosAcreedorBinding
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/**
 * Fiado con las mismas reglas que la web: lista de acreedores activos con
 * saldo, estado por proyectado (OK/ADVERTENCIA/LIMITE), LIMITE bloquea y
 * ADVERTENCIA exige segundo tap de confirmación.
 */
class PosFiadoDialog : DialogFragment() {
    private var _b: DialogPosFiadoBinding? = null
    private val b get() = _b!!
    private fun dash(): PosDashFragment = parentFragment as PosDashFragment
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    private var warnAckFor: Int? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogPosFiadoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        // Ancho completo: el default de DialogFragment es angosto y corta nombres.
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.tvFiadoTotal.text = "Total: ${money.format(dash().cart.total)}"
        b.rvAcreedores.layoutManager = LinearLayoutManager(requireContext())
        b.rvAcreedores.adapter = AcreedorAdapter()
        b.btnFiadoCancel.setOnClickListener { dismissAllowingStateLoss() }
        load()
    }

    private fun load() {
        lifecycleScope.launch {
            try {
                val list = dash().salesRepo.acreedores()
                (b.rvAcreedores.adapter as? AcreedorAdapter)?.set(list)
                if (list.isEmpty() && isAdded) b.tvFiadoError.text = "No hay acreedores activos"
            } catch (e: Exception) {
                if (isAdded) b.tvFiadoError.text = e.message ?: "Error cargando acreedores"
            }
        }
    }

    private fun estado(a: PosAcreedor): String {
        val proyectado = (a.saldo ?: 0.0) + dash().cart.total
        if (a.limiteDeuda != null && proyectado > a.limiteDeuda) return "LIMITE"
        if (a.advertenciaDeuda != null && proyectado > a.advertenciaDeuda) return "ADVERTENCIA"
        return "OK"
    }

    private fun pick(a: PosAcreedor) {
        when (estado(a)) {
            "LIMITE" -> {
                val proyectado = (a.saldo ?: 0.0) + dash().cart.total
                b.tvFiadoError.text =
                    "Monto máximo superado: llegaría a ${money.format(proyectado)} y el límite es ${money.format(a.limiteDeuda ?: 0.0)}."
            }
            "ADVERTENCIA" -> {
                if (warnAckFor != a.id) {
                    warnAckFor = a.id
                    b.tvFiadoError.text = "Supera la advertencia (${money.format(a.advertenciaDeuda ?: 0.0)}). Tocá de nuevo para confirmar."
                } else {
                    confirm(a)
                }
            }
            else -> confirm(a)
        }
    }

    private fun confirm(a: PosAcreedor) {
        lifecycleScope.launch {
            try {
                val sale = dash().salesRepo.fiado(dash().cart, a.id)
                dismissAllowingStateLoss()
                dash().finalizeApproved(sale)
            } catch (e: Exception) {
                if (com.mposw.entradas.data.ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                if (isAdded) b.tvFiadoError.text = e.message ?: "Error registrando fiado"
            }
        }
    }

    private fun toast(msg: String) {
        if (!isAdded) return
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }

    private inner class AcreedorAdapter : RecyclerView.Adapter<AcreedorAdapter.Holder>() {
        private var items: List<PosAcreedor> = emptyList()
        fun set(v: List<PosAcreedor>) {
            items = v
            notifyDataSetChanged()
        }

        inner class Holder(val b: ItemPosAcreedorBinding) : RecyclerView.ViewHolder(b.root) {
            init {
                b.root.setOnClickListener {
                    val i = bindingAdapterPosition
                    if (i >= 0 && i < items.size) pick(items[i])
                }
            }
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
            Holder(ItemPosAcreedorBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val a = items[position]
            h.b.tvAcreedorName.text = a.nombre ?: ""
            h.b.tvAcreedorSaldo.text = "Deuda: ${money.format(a.saldo ?: 0.0)}"
            // Solo icono de estado al lado del nombre (el detalle va en el error al tocar).
            when (estado(a)) {
                "LIMITE" -> {
                    h.b.tvAcreedorIcon.visibility = View.VISIBLE
                    h.b.tvAcreedorIcon.text = "⛔"
                    h.b.tvAcreedorIcon.contentDescription = "Límite superado"
                }
                "ADVERTENCIA" -> {
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

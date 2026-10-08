package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.mposw.entradas.databinding.ItemPosCartLineBinding
import com.mposw.entradas.databinding.SheetPosCartBinding
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/** Carrito slide-up: líneas con +/−/eliminar, descuentos y total. */
class PosCartSheet : BottomSheetDialogFragment() {
    private var _b: SheetPosCartBinding? = null
    private val b get() = _b!!
    private fun dash(): PosDashFragment = parentFragment as PosDashFragment
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = SheetPosCartBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.rvCart.layoutManager = LinearLayoutManager(requireContext())
        b.rvCart.adapter = LineAdapter()
        b.btnCartClose.setOnClickListener { dismissAllowingStateLoss() }
        b.btnCartReprint.setOnClickListener { reprint() }
        refresh()
    }

    fun refresh() {
        if (_b == null) return
        (b.rvCart.adapter as? LineAdapter)?.refresh()
        val cart = dash().cart
        val descLines = cart.discounts.map { "− ${it.titulo} (${it.porcentaje}%): ${money.format(it.monto)}" } +
            (cart.entradaDesc?.let { listOf("− ${it.nombre}: ${money.format(it.monto)}") } ?: emptyList())
        b.tvCartDiscounts.text = descLines.joinToString("\n")
        b.tvCartDiscounts.visibility = if (descLines.isEmpty()) View.GONE else View.VISIBLE
        b.tvCartTotal.text = "TOTAL  ${money.format(cart.total)}"
        dash().refreshTotal()
    }

    private fun reprint() {
        lifecycleScope.launch {
            val dash = parentFragment as? PosDashFragment ?: return@launch
            val last = dash.salesRepo.lastApproved()
            if (last == null) {
                Toast.makeText(requireContext(), "Sin ventas para reimprimir", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val sale = try {
                com.google.gson.Gson().fromJson(last.payloadJson, com.mposw.entradas.data.PosSale::class.java)
            } catch (_: Exception) { null }
            if (sale == null) {
                Toast.makeText(requireContext(), "No se pudo leer la última venta", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val ok = PosTicketRenderer.print(requireContext(), sale)
            Toast.makeText(
                requireContext(),
                if (ok) "Reimpreso" else "Error de impresora",
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private inner class LineAdapter : RecyclerView.Adapter<LineAdapter.Holder>() {
        inner class Holder(val b: ItemPosCartLineBinding) : RecyclerView.ViewHolder(b.root)

        fun refresh() = notifyDataSetChanged()

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
            Holder(ItemPosCartLineBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount(): Int = dash().cart.lines.size

        override fun onBindViewHolder(h: Holder, position: Int) {
            val cart = dash().cart
            val line = cart.lines[position]
            h.b.tvLineName.text = line.product.name
            h.b.tvLinePrice.text = "${money.format(line.product.price)} c/u · ${money.format(line.product.price * line.quantity)}"
            h.b.tvQty.text = line.quantity.toString()
            h.b.btnMinus.setOnClickListener { cart.setQuantity(line.product.id, line.quantity - 1); refresh() }
            h.b.btnPlus.setOnClickListener { cart.setQuantity(line.product.id, line.quantity + 1); refresh() }
            h.b.btnDel.setOnClickListener { cart.remove(line.product.id); refresh() }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

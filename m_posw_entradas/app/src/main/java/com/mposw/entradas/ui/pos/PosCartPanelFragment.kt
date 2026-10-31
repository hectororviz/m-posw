package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.databinding.FragmentPosCartPanelBinding
import com.mposw.entradas.databinding.ItemPosCartLineBinding
import com.mposw.entradas.ui.MainActivity
import com.mposw.entradas.util.MoneyFormat

/**
 * Contenido del carrito (líneas +/−/eliminar, descuentos, total, Cobrar):
 * se embebe en el lateral en tablet apaisada y dentro del bottom sheet
 * en teléfono. El cobro abre el mismo PaySheet en ambos casos.
 */
class PosCartPanelFragment : Fragment() {
    private var _b: FragmentPosCartPanelBinding? = null
    private val b get() = _b!!

    private val inSheet: Boolean get() = requireArguments().getBoolean("inSheet", false)

    private fun dash(): PosDashFragment {
        return when (val p = parentFragment) {
            is PosDashFragment -> p
            is PosCartSheet -> p.dash()
            else -> throw IllegalStateException("panel sin dash")
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentPosCartPanelBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.rvCart.layoutManager = LinearLayoutManager(requireContext())
        b.rvCart.adapter = LineAdapter()
        b.btnPanelClose.visibility = if (inSheet) View.VISIBLE else View.GONE
        b.btnPanelCollapse.visibility = if (inSheet) View.GONE else View.VISIBLE
        b.btnPanelConfig.visibility = if (inSheet) View.GONE else View.VISIBLE
        b.btnPanelClose.setOnClickListener { (parentFragment as? PosCartSheet)?.dismissAllowingStateLoss() }
        b.btnPanelCollapse.setOnClickListener { (parentFragment as? PosDashFragment)?.setSideCartCollapsed(true) }
        b.btnPanelConfig.setOnClickListener { (activity as? MainActivity)?.openConfig() }
        b.btnPanelCobrar.setOnClickListener { dash().pagar() }
        refresh()
    }

    fun refresh() {
        if (_b == null) return
        (b.rvCart.adapter as? LineAdapter)?.refresh()
        val cart = dash().cart
        val descLines = cart.discounts.map { "− ${it.titulo} (${it.porcentaje}%): ${MoneyFormat.format(it.monto)}" } +
            (cart.entradaDesc?.let { listOf("− ${it.nombre}: ${MoneyFormat.format(it.monto)}") } ?: emptyList())
        b.tvCartDiscounts.text = descLines.joinToString("\n")
        b.tvCartDiscounts.visibility = if (descLines.isEmpty()) View.GONE else View.VISIBLE
        b.tvCartTotal.text = "TOTAL  ${MoneyFormat.format(cart.total)}"
        b.btnPanelCobrar.isEnabled = cart.lines.isNotEmpty()
        dash().refreshTotal(fromPanel = true)
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
            h.b.tvLinePrice.text = "${MoneyFormat.format(line.product.price)} c/u · ${MoneyFormat.format(line.product.price * line.quantity)}"
            h.b.tvQty.text = line.quantity.toString()
            // OJO: refresh() a secas resolvería al del adapter (solo re-bindea
            // filas); hay que llamar al del panel para actualizar el total.
            h.b.btnMinus.setOnClickListener { cart.setQuantity(line.product.id, line.quantity - 1); this@PosCartPanelFragment.refresh() }
            h.b.btnPlus.setOnClickListener { cart.setQuantity(line.product.id, line.quantity + 1); this@PosCartPanelFragment.refresh() }
            h.b.btnDel.setOnClickListener { cart.remove(line.product.id); this@PosCartPanelFragment.refresh() }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(inSheet: Boolean): PosCartPanelFragment {
            val f = PosCartPanelFragment()
            f.arguments = Bundle().apply { putBoolean("inSheet", inSheet) }
            return f
        }
    }
}

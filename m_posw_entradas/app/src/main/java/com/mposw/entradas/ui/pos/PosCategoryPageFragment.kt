package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.GridLayoutManager
import com.mposw.entradas.databinding.PagePosCategoryBinding

/** Una página del ViewPager: grilla de productos de una categoría. */
class PosCategoryPageFragment : Fragment() {
    private var _b: PagePosCategoryBinding? = null
    private val b get() = _b!!

    private val categoryId: String get() = requireArguments().getString("categoryId") ?: ""
    private fun dash(): PosDashFragment? = parentFragment as? PosDashFragment

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = PagePosCategoryBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val d = dash() ?: return
        val rv = b.rvProductos
        rv.setHasFixedSize(true)
        val dm = resources.displayMetrics
        val target = d.cardTargetDp()
        val lm = GridLayoutManager(requireContext(), d.gridSpan())
        rv.layoutManager = lm
        // Foto cuadrada: lado = tarjeta menos insets fijos del item
        // (margen 4+4 + padding 8+8 = 24dp). Constante por escala.
        val imageSidePx = ((target - 24) * dm.density).toInt().coerceAtLeast(1)
        val adapter = PosProductAdapter(
            d.textScaleFactor(),
            d.apiRoot(),
            d::productImageFile,
            imageSidePx,
        ) { p -> d.onProductTap(p) }
        rv.adapter = adapter
        val rows = d.productsOf(categoryId).map { PosProductRow(it, d.cartQtyOf(it.id)) }
        adapter.submitList(rows)
        b.tvEmpty.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        b.loadError.visibility = View.GONE
        b.btnRetry.setOnClickListener { d.reloadCatalog() }
        restyle()
    }

    /**
     * Aplica el span desde métricas de ventana (sincrónico, sin medir
     * vistas). Lo llama el dash tras abrir/cerrar el lateral. El RV queda
     * match_parent (nunca desborda); solo cambia la cantidad.
     */
    fun restyle() {
        val binding = _b ?: return
        val lm = binding.rvProductos.layoutManager as? GridLayoutManager ?: return
        val span = try {
            dash()?.gridSpan() ?: lm.spanCount
        } catch (_: Exception) {
            return
        }
        if (lm.spanCount != span) lm.spanCount = span
    }

    /** Muestra el estado de error de carga con reintento. */
    fun showLoadError() {
        if (_b == null) return
        b.tvEmpty.visibility = View.GONE
        b.loadError.visibility = View.VISIBLE
    }

    /** Actualiza solo las insignias de cantidad sin recargar la grilla. */
    fun refreshQty(qty: Map<String, Int>) {
        val binding = _b ?: return
        val adapter = binding.rvProductos.adapter as? PosProductAdapter ?: return
        adapter.submitList(adapter.currentList.map { it.copy(qty = qty[it.product.id] ?: 0) })
    }

    /** Re-bindea todo (p. ej. llegaron fotos a la caché propia en segundo plano). */
    fun refreshImages() {
        val binding = _b ?: return
        (binding.rvProductos.adapter as? PosProductAdapter)?.notifyDataSetChanged()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(categoryId: String): PosCategoryPageFragment {
            val f = PosCategoryPageFragment()
            f.arguments = Bundle().apply { putString("categoryId", categoryId) }
            return f
        }
    }
}

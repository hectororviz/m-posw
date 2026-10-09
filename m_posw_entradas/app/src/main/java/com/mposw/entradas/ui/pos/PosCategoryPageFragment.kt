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

    /** Columnas según el ancho real: 150dp mínimo por tarjeta, entre 2 y 4. */
    internal fun spanForWidth(widthPx: Int, density: Float): Int {
        if (widthPx <= 0 || density <= 0) return 2
        return ((widthPx / density) / 150).toInt().coerceIn(2, 4)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = PagePosCategoryBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val d = dash() ?: return
        val rv = b.rvProductos
        rv.setHasFixedSize(true)
        val lm = GridLayoutManager(requireContext(), 2)
        rv.layoutManager = lm
        val adapter = PosProductAdapter(d.textScaleFactor(), d.imageHeightDp(), d.apiRoot()) { p -> d.onProductTap(p) }
        rv.adapter = adapter
        val rows = d.productsOf(categoryId).map { PosProductRow(it, d.cartQtyOf(it.id)) }
        adapter.submitList(rows)
        b.tvEmpty.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        b.loadError.visibility = View.GONE
        b.btnRetry.setOnClickListener { d.reloadCatalog() }
        rv.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val span = spanForWidth(v.width, resources.displayMetrics.density)
            if (lm.spanCount != span) lm.spanCount = span
        }
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

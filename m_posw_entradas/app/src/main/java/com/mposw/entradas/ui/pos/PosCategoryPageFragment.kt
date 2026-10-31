package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.GridLayoutManager
import com.mposw.entradas.R
import com.mposw.entradas.databinding.PagePosCategoryBinding

/** Una página del ViewPager: grilla de productos de una categoría. */
class PosCategoryPageFragment : Fragment() {
    private var _b: PagePosCategoryBinding? = null
    private val b get() = _b!!

    private val categoryId: String get() = requireArguments().getString("categoryId") ?: ""
    private fun dash(): PosDashFragment? = parentFragment as? PosDashFragment

    /** Columnas según el ancho del contenedor y el tamaño objetivo (fijo por escala). */
    internal fun spanForWidth(parentPx: Int, density: Float, targetDp: Int, max: Int): Int {
        if (parentPx <= 0 || density <= 0 || targetDp <= 0) return 2
        return ((parentPx / density) / targetDp).toInt().coerceIn(1, max)
    }

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
        val lm = GridLayoutManager(requireContext(), 2)
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
        // Se escucha al contenedor (match_parent): el RV tiene ancho fijo y
        // sus propios bounds no cambian al togglear el lateral.
        b.root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> restyle() }
    }

    /**
     * Grilla de tamaño fijo: el span solo decide cantidad y el RV toma ancho
     * exacto `span × tamaño`, centrado (el sobrante queda de margen).
     * Lo llama el dash tras abrir/cerrar el lateral y el listener del
     * contenedor en rotaciones. Sin re-bindear: los tamaños no cambian.
     */
    fun restyle() {
        val binding = _b ?: return
        val rv = binding.rvProductos
        val lm = rv.layoutManager as? GridLayoutManager ?: return
        val parentW = (rv.parent as? View)?.width ?: 0
        if (parentW <= 0) return
        val dm = resources.displayMetrics
        val max = try { resources.getInteger(R.integer.grid_max_span) } catch (_: Exception) { 4 }
        val target = dash()?.cardTargetDp() ?: 180
        val targetPx = (target * dm.density).toInt()
        if (targetPx <= 0) return
        val span = spanForWidth(parentW, dm.density, target, max)
        if (lm.spanCount != span) lm.spanCount = span
        val lp = rv.layoutParams as? FrameLayout.LayoutParams ?: return
        val wantW = span * targetPx
        var changed = false
        if (lp.width != wantW) {
            lp.width = wantW
            changed = true
        }
        if (lp.gravity != Gravity.CENTER_HORIZONTAL) {
            lp.gravity = Gravity.CENTER_HORIZONTAL
            changed = true
        }
        if (changed) {
            rv.layoutParams = lp
            rv.requestLayout()
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

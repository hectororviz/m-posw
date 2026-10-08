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
        val span = when (d.textScaleKey()) {
            "S" -> 3
            "L" -> 2
            else -> 2
        }
        b.rvProductos.layoutManager = GridLayoutManager(requireContext(), span)
        val adapter = PosProductAdapter(d.textScaleFactor(), d.imageHeightDp(), d.apiRoot()) { p -> d.onProductTap(p) }
        adapter.items = d.productsOf(categoryId)
        b.rvProductos.adapter = adapter
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

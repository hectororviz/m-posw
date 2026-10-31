package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.mposw.entradas.R
import com.mposw.entradas.databinding.SheetPosCartBinding
import com.mposw.entradas.util.DialogStyle

/** Carrito slide-up en teléfono: contenedor del panel compartido. */
class PosCartSheet : BottomSheetDialogFragment() {
    private var _b: SheetPosCartBinding? = null
    private val b get() = _b!!
    fun dash(): PosDashFragment = parentFragment as PosDashFragment

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = SheetPosCartBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        // En tablets el sheet no ocupa todo el ancho.
        DialogStyle.capWidth(this, fullHeight = true)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        if (childFragmentManager.findFragmentByTag("panel") == null) {
            childFragmentManager.beginTransaction()
                .replace(R.id.cartHost, PosCartPanelFragment.new(true), "panel")
                .commit()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

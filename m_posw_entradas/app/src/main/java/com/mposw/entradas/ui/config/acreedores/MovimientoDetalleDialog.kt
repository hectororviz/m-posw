package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import com.mposw.entradas.databinding.DialogMovimientoDetalleBinding
import com.mposw.entradas.util.DialogStyle

/** Detalle de un movimiento (solo lectura). */
class MovimientoDetalleDialog : DialogFragment() {
    companion object {
        fun new(titulo: String, cuerpo: String): MovimientoDetalleDialog {
            val d = MovimientoDetalleDialog()
            d.arguments = Bundle().apply {
                putString("titulo", titulo)
                putString("cuerpo", cuerpo)
            }
            return d
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val b = DialogMovimientoDetalleBinding.inflate(inflater, container, false)
        b.tvMovDetalleTitulo.text = arguments?.getString("titulo").orEmpty()
        b.tvMovDetalleCuerpo.text = arguments?.getString("cuerpo").orEmpty()
        b.btnMovDetalleCerrar.setOnClickListener { dismissAllowingStateLoss() }
        return b.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        DialogStyle.capWidth(this)
        DialogStyle.round(dialog?.window)
    }
}

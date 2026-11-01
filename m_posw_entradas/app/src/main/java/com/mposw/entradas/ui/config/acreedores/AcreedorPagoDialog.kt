package com.mposw.entradas.ui.config.acreedores

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.DialogAcreedorPagoBinding
import com.mposw.entradas.util.DialogStyle
import kotlinx.coroutines.launch

/** Solo registro de pago en efectivo (sin comprobante impreso). */
class AcreedorPagoDialog : DialogFragment() {
    private var _b: DialogAcreedorPagoBinding? = null
    private val b get() = _b!!
    private var acreedorId: Int = 0
    private var acreedorNombre: String = ""

    companion object {
        fun new(id: Int, nombre: String): AcreedorPagoDialog {
            val d = AcreedorPagoDialog()
            d.arguments = Bundle().apply {
                putInt("id", id)
                putString("nombre", nombre)
            }
            return d
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acreedorId = arguments?.getInt("id", 0) ?: 0
        acreedorNombre = arguments?.getString("nombre").orEmpty()
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogAcreedorPagoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        DialogStyle.capWidth(this)
        DialogStyle.round(dialog?.window)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.tvPagoPara.text = acreedorNombre
        b.btnPagoCancel.setOnClickListener { dismissAllowingStateLoss() }
        b.btnPagoGuardar.setOnClickListener { guardar() }
    }

    private fun parseMonto(raw: String): Double? {
        // "$ 1.200,50" | "1200,50" | "1200.50" -> Double.
        var s = raw.trim()
            .replace("$", "")
            .replace(" ", "")
        if (s.isEmpty()) return null
        // Si hay coma decimal, los puntos son miles.
        if (s.contains(",")) {
            s = s.replace(".", "").replace(",", ".")
        }
        return s.toDoubleOrNull()
    }

    private fun guardar() {
        val monto = parseMonto(b.etPagoMonto.text?.toString().orEmpty())
        if (monto == null || monto <= 0) {
            b.tvPagoError.text = "El monto debe ser mayor a 0"
            return
        }
        val notas = b.etPagoNotas.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
        b.tvPagoError.text = ""
        b.btnPagoGuardar.isEnabled = false
        lifecycleScope.launch {
            try {
                val repo = PosSalesRepo(requireContext(), SessionManager(requireContext()))
                repo.pagar(acreedorId, monto, notas)
                if (!isAdded) return@launch
                (parentFragment as? AcreedorDetalleDialog)?.onPagoRegistrado()
                dismissAllowingStateLoss()
            } catch (e: Exception) {
                if (!isAdded) return@launch
                b.btnPagoGuardar.isEnabled = true
                if (ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                b.tvPagoError.text = ApiClient.parseError(e)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

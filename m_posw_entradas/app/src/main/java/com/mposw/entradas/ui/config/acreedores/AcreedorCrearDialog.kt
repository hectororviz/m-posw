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
import com.mposw.entradas.databinding.DialogAcreedorCrearBinding
import com.mposw.entradas.util.DialogStyle
import kotlinx.coroutines.launch

/** Alta mínima: solo nombre (el equipo no tiene línea, sin teléfono). */
class AcreedorCrearDialog : DialogFragment() {
    private var _b: DialogAcreedorCrearBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogAcreedorCrearBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        DialogStyle.capWidth(this)
        DialogStyle.round(dialog?.window)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.btnCrearCancel.setOnClickListener { dismissAllowingStateLoss() }
        b.btnCrearGuardar.setOnClickListener { guardar() }
    }

    private fun guardar() {
        val nombre = b.etAcreedorNombre.text?.toString()?.trim().orEmpty()
        if (nombre.isEmpty()) {
            b.tvCrearError.text = "El nombre es obligatorio"
            return
        }
        b.tvCrearError.text = ""
        b.btnCrearGuardar.isEnabled = false
        lifecycleScope.launch {
            try {
                val repo = PosSalesRepo(requireContext(), SessionManager(requireContext()))
                repo.crearAcreedor(nombre)
                if (!isAdded) return@launch
                (parentFragment as? ConfigAcreedoresFragment)?.reload()
                dismissAllowingStateLoss()
            } catch (e: Exception) {
                if (!isAdded) return@launch
                b.btnCrearGuardar.isEnabled = true
                if (ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                b.tvCrearError.text = ApiClient.parseError(e)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

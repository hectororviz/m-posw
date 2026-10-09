package com.mposw.entradas.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.databinding.FragmentPagoExitosoBinding
import com.mposw.entradas.util.DialogStyle
import com.mposw.entradas.util.MoneyFormat
import com.mposw.entradas.util.PrintHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PagoExitosoDialogFragment : DialogFragment() {
    private var _b: FragmentPagoExitosoBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentPagoExitosoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        DialogStyle.round(dialog?.window)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val codigos = requireArguments().getString("codigos").orEmpty()
        val total = requireArguments().getString("total").orEmpty()
        val printedOk = requireArguments().getBoolean("printedOk", true)
        b.tvOkCodigos.text = codigos
        b.tvOkTotal.text = MoneyFormat.formatRaw(total)
        if (printedOk) {
            b.tvOkPrint.visibility = View.GONE
            b.btnOkReprint.visibility = View.GONE
        } else {
            // Estado persistente y completo: sin auto-cierre para que se lea.
            // TODO(backend): SunmiPrinter.printSale solo devuelve Boolean; para mostrar
            // el <motivo> hay que propagar la causa (sin papel, sin impresora, etc.).
            b.tvOkPrint.visibility = View.VISIBLE
            b.tvOkPrint.text = "Pago registrado. No se pudo imprimir."
            b.btnOkReprint.visibility = View.VISIBLE
        }
        b.btnOkCerrar.setOnClickListener { dismissAllowingStateLoss() }
        b.btnOkReprint.setOnClickListener { reintentar() }
        b.ivOkCheck.scaleX = 0.3f
        b.ivOkCheck.scaleY = 0.3f
        b.ivOkCheck.alpha = 0f
        b.ivOkCheck.animate()
            .scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(150)
            .setInterpolator(OvershootInterpolator(1.6f))
            .start()
        if (printedOk) {
            lifecycleScope.launch {
                delay(2400)
                if (isAdded) dismissAllowingStateLoss()
            }
        }
    }

    private fun reintentar() {
        b.btnOkReprint.isEnabled = false
        lifecycleScope.launch {
            val ok = try {
                PrintHelper.reprintLast(requireContext())
            } catch (_: Exception) {
                false
            }
            if (!isAdded) return@launch
            if (ok) {
                b.tvOkPrint.text = "Pago registrado. Impresión correcta."
                b.btnOkReprint.visibility = View.GONE
                lifecycleScope.launch {
                    delay(2400)
                    if (isAdded) dismissAllowingStateLoss()
                }
            } else {
                b.tvOkPrint.text = "Pago registrado. No se pudo imprimir."
                b.btnOkReprint.isEnabled = true
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(codigos: String?, total: String?, printedOk: Boolean = true): PagoExitosoDialogFragment {
            val f = PagoExitosoDialogFragment()
            f.arguments = Bundle().apply {
                putString("codigos", codigos)
                putString("total", total)
                putBoolean("printedOk", printedOk)
            }
            return f
        }
    }
}

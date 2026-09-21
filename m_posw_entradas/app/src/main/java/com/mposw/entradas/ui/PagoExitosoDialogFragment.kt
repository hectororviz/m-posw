package com.mposw.entradas.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.databinding.FragmentPagoExitosoBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PagoExitosoDialogFragment : DialogFragment() {
    private var _b: FragmentPagoExitosoBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentPagoExitosoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val codigos = requireArguments().getString("codigos").orEmpty()
        val total = requireArguments().getString("total").orEmpty()
        b.tvOkCodigos.text = codigos
        b.tvOkTotal.text = if (total.isNotBlank()) "$$total" else ""
        b.btnOkCerrar.setOnClickListener { dismissAllowingStateLoss() }
        b.ivOkCheck.scaleX = 0.3f
        b.ivOkCheck.scaleY = 0.3f
        b.ivOkCheck.alpha = 0f
        b.ivOkCheck.animate()
            .scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(450)
            .setInterpolator(OvershootInterpolator(1.6f))
            .start()
        lifecycleScope.launch {
            delay(2400)
            if (isAdded) dismissAllowingStateLoss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(codigos: String, total: String): PagoExitosoDialogFragment {
            val f = PagoExitosoDialogFragment()
            f.arguments = Bundle().apply {
                putString("codigos", codigos)
                putString("total", total)
            }
            return f
        }
    }
}

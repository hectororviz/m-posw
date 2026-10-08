package com.mposw.entradas.ui.pos

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.databinding.FragmentQrPagoBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Espera de pago QR del POS: imagen estática del punto de venta + polling
 * de estado cada 2s hasta 120s (igual que el front web). Al aprobar trae
 * la venta completa y finaliza como el efectivo.
 */
class PosQrWaitDialog : DialogFragment() {
    private var _b: FragmentQrPagoBinding? = null
    private val b get() = _b!!
    private var pollJob: Job? = null

    private val saleId: String get() = requireArguments().getString("saleId") ?: ""
    private fun dash(): PosDashFragment = parentFragment as PosDashFragment

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentQrPagoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val total = requireArguments().getString("total") ?: ""
        b.tvQrMonto.text = "$$total"
        b.btnCancelQr.setOnClickListener { cancelar() }
        lifecycleScope.launch {
            val bmp = loadQrImage()
            if (isAdded) {
                if (bmp != null) b.ivQr.setImageBitmap(bmp)
                else b.tvQrHint.text = "QR no configurado. Revisá Mercado Pago en el front."
            }
        }
        startPolling()
    }

    private suspend fun loadQrImage(): Bitmap? {
        return try {
            val qr = dash().salesRepo.mpQr()
            val data = qr.qrData ?: return null
            if (data.startsWith("data:image")) {
                val b64 = data.substringAfter("base64,")
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } else {
                dash().salesRepo.downloadBitmap(data)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun startPolling() {
        pollJob = lifecycleScope.launch {
            val deadline = System.currentTimeMillis() + 120_000L
            while (System.currentTimeMillis() < deadline) {
                delay(2000)
                try {
                    val st = dash().salesRepo.status(saleId)
                    val left = ((deadline - System.currentTimeMillis()) / 1000).toInt()
                    if (isAdded) b.tvQrCountdown.text = "Esperando pago… ${left}s"
                    when (st.status) {
                        "APPROVED" -> {
                            val sale = dash().salesRepo.sale(saleId)
                            dismissAllowingStateLoss()
                            dash().finalizeApproved(sale)
                            return@launch
                        }
                        "REJECTED", "EXPIRED", "CANCELLED" -> {
                            if (isAdded) b.tvQrHint.text = "Pago ${st.status}. Cerrá y generá un cobro nuevo."
                            pollJob?.cancel()
                            return@launch
                        }
                        else -> Unit
                    }
                } catch (e: Exception) {
                    if (isAdded) b.tvQrHint.text = e.message ?: "Error consultando estado"
                }
            }
            try { dash().salesRepo.cancel(saleId) } catch (_: Exception) {}
            if (isAdded) b.tvQrHint.text = "Tiempo agotado (2 min). Se canceló el cobro."
        }
    }

    private fun cancelar() {
        lifecycleScope.launch {
            try { dash().salesRepo.cancel(saleId) } catch (_: Exception) {}
            pollJob?.cancel()
            dismissAllowingStateLoss()
        }
    }

    override fun onDestroyView() {
        pollJob?.cancel()
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(saleId: String, total: String): PosQrWaitDialog {
            val f = PosQrWaitDialog()
            f.arguments = Bundle().apply {
                putString("saleId", saleId)
                putString("total", total)
            }
            return f
        }
    }
}

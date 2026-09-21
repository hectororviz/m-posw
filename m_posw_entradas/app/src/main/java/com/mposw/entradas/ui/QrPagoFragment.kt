package com.mposw.entradas.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.mposw.entradas.data.AppDb
import com.mposw.entradas.data.ApprovedSale
import com.mposw.entradas.data.EntradasRepo
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.FragmentQrPagoBinding
import com.mposw.entradas.printer.SunmiPrinter
import com.mposw.entradas.printer.TicketRenderer
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class QrPagoFragment : DialogFragment() {
    private var _b: FragmentQrPagoBinding? = null
    private val b get() = _b!!
    private lateinit var repo: EntradasRepo
    private lateinit var session: SessionManager
    private var pollJob: Job? = null

    private val saleId: String get() = requireArguments().getString("saleId") ?: ""
    private val qrUrl: String get() = requireArguments().getString("qrUrl") ?: ""
    private val total: String get() = requireArguments().getString("total") ?: ""
    private val fixtureId: String get() = requireArguments().getString("fixtureId") ?: ""
    private val sector: String get() = requireArguments().getString("sector") ?: ""
    private val cantidad: Int get() = requireArguments().getInt("cantidad", 0)

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentQrPagoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        repo = EntradasRepo(session)
        b.tvQrMonto.text = "$$total"
        b.btnCancelQr.setOnClickListener { cancelar() }
        lifecycleScope.launch {
            val bmp = repo.downloadBitmap(qrUrl)
            if (bmp != null) b.ivQr.setImageBitmap(bmp)
            else b.tvQrHint.text = "No se pudo descargar el QR. Revisá conexión."
        }
        startPolling()
    }

    private fun startPolling() {
        pollJob = lifecycleScope.launch {
            val deadline = System.currentTimeMillis() + 5 * 60_000L
            while (System.currentTimeMillis() < deadline) {
                delay(2500)
                try {
                    val p = repo.status(saleId)
                    repo.syncTemplateIfNeeded(p.templateVersion, p.logoVersion)
                    val left = ((deadline - System.currentTimeMillis()) / 1000).toInt()
                    b.tvQrCountdown.text = "Esperando pago… ${left}s"
                    when (p.status) {
                        "APPROVED" -> {
                            val json = Gson().toJson(p)
                            AppDb.get(requireContext()).sales().upsert(ApprovedSale(saleId, json))
                            val elements = TicketRenderer.parseTemplate(session.templateJson)
                            val escudo = SunmiPrinter.escudoBitmap(session.escudoBase64)
                            SunmiPrinter.printSale(requireContext(), p, elements, escudo)
                            parentFragmentManager.setFragmentResult(
                                "qr_aprobado",
                                androidx.core.os.bundleOf(
                                    "fixtureId" to fixtureId,
                                    "sector" to sector,
                                    "cantidad" to (if (cantidad > 0) cantidad else p.cantidad),
                                ),
                            )
                            dismissAllowingStateLoss()
                            PagoExitosoDialogFragment.new((p.codigos ?: emptyList()).joinToString(", "), p.total)
                                .show(parentFragmentManager, "ok")
                            return@launch
                        }
                        "EXPIRED", "REJECTED", "CANCELLED" -> {
                            b.tvQrHint.text = "Pago ${p.status}. Cerrá y reintentá con un cobro nuevo."
                            pollJob?.cancel()
                            return@launch
                        }
                        else -> Unit
                    }
                } catch (e: Exception) {
                    b.tvQrHint.text = e.message ?: "Error consultando estado"
                }
            }
            try { repo.cancel(saleId) } catch (_: Exception) {}
            b.tvQrHint.text = "Tiempo agotado (5 min). Se canceló el cobro."
        }
    }

    private fun cancelar() {
        lifecycleScope.launch {
            try { repo.cancel(saleId) } catch (_: Exception) {}
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
        fun new(
            saleId: String?,
            qrUrl: String?,
            total: String?,
            fixtureId: String = "",
            sector: String = "",
            cantidad: Int = 0,
        ): QrPagoFragment {
            val f = QrPagoFragment()
            f.arguments = Bundle().apply {
                putString("saleId", saleId)
                putString("qrUrl", qrUrl)
                putString("total", total)
                putString("fixtureId", fixtureId)
                putString("sector", sector)
                putInt("cantidad", cantidad)
            }
            return f
        }
    }
}

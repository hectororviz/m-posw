package com.mposw.entradas.ui.pos

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.mposw.entradas.data.PosSale
import com.mposw.entradas.data.pos.PosCart
import com.mposw.entradas.databinding.SheetPosPayBinding
import com.mposw.entradas.ui.ScannerActivity
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.round

/**
 * Un único botón de pago: CASH (numpad) o MP_QR + un único escaneo de
 * descuento (carnet de socio o beneficio de entrada, se bifurca por formato
 * con el mecanismo ya existente en el back).
 */
class PosPaySheet : BottomSheetDialogFragment() {
    private var _b: SheetPosPayBinding? = null
    private val b get() = _b!!
    private fun dash(): PosDashFragment = parentFragment as PosDashFragment
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    private var cashInput = ""
    private var busy = false

    private val cameraPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val scanDiscount = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents
        if (raw == null) {
            toast("Escaneo cancelado")
            return@registerForActivityResult
        }
        resolveDiscount(raw)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = SheetPosPayBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        cameraPerm.launch(Manifest.permission.CAMERA)
        refreshTotal()
        selectTabCash()
        b.btnTabCash.setOnClickListener { selectTabCash() }
        b.btnTabQr.setOnClickListener { selectTabQr() }
        b.btnScanDiscount.setOnClickListener {
            scanDiscount.launch(ScanOptions().setPrompt("Escaneá carnet de socio o QR de entrada").setBeepEnabled(true).setCaptureActivity(ScannerActivity::class.java))
        }
        b.btnClearDiscount.setOnClickListener {
            dash().cart.clearSocio()
            dash().cart.setEntradaDesc(null)
            refreshTotal()
            dash().refreshTotal()
        }
        numpad()
        b.btnConfirmCash.setOnClickListener { confirmCash() }
        b.btnCobrarQr.setOnClickListener { cobrarQr() }
    }

    private fun refreshTotal() {
        if (_b == null) return
        val cart = dash().cart
        b.tvPayTotal.text = money.format(cart.total)
        val parts = mutableListOf<String>()
        cart.socioNombre?.let { parts.add("Socio: $it (−${money.format(cart.discounts.sumOf { d -> d.monto })})") }
        cart.entradaDesc?.let { parts.add("${it.nombre} (−${money.format(it.monto)})") }
        b.tvDiscountInfo.text = parts.joinToString("\n")
        b.tvDiscountInfo.visibility = if (parts.isEmpty()) View.GONE else View.VISIBLE
        b.btnClearDiscount.visibility =
            if (cart.socioId != null || cart.entradaDesc != null) View.VISIBLE else View.GONE
        refreshCash()
    }

    private fun selectTabCash() {
        b.btnTabCash.isChecked = true
        b.btnTabQr.isChecked = false
        b.cashBox.visibility = View.VISIBLE
        b.qrBox.visibility = View.GONE
    }

    private fun selectTabQr() {
        b.btnTabCash.isChecked = false
        b.btnTabQr.isChecked = true
        b.cashBox.visibility = View.GONE
        b.qrBox.visibility = View.VISIBLE
    }

    private fun numpad() {
        val digit = { s: String ->
            if (cashInput.length < 9) {
                cashInput += s
                refreshCash()
            }
        }
        b.k1.setOnClickListener { digit("1") }
        b.k2.setOnClickListener { digit("2") }
        b.k3.setOnClickListener { digit("3") }
        b.k4.setOnClickListener { digit("4") }
        b.k5.setOnClickListener { digit("5") }
        b.k6.setOnClickListener { digit("6") }
        b.k7.setOnClickListener { digit("7") }
        b.k8.setOnClickListener { digit("8") }
        b.k9.setOnClickListener { digit("9") }
        b.k0.setOnClickListener { digit("0") }
        b.k00.setOnClickListener { digit("00") }
        b.kBack.setOnClickListener {
            if (cashInput.isNotEmpty()) {
                cashInput = cashInput.dropLast(1)
                refreshCash()
            }
        }
    }

    private fun refreshCash() {
        if (_b == null) return
        val received = cashInput.toDoubleOrNull() ?: 0.0
        val total = dash().cart.total
        b.tvCashReceived.text = money.format(received)
        val change = received - total
        b.tvCashChange.text = if (cashInput.isEmpty()) "" else "Vuelto: ${money.format(change)}"
    }

    // ── Descuento unificado ──────────────────────────────
    private fun resolveDiscount(raw: String) {
        val t = raw.trim()
        // Sin guiones / con prefijo ENT: → beneficio de entrada; UUID → socio.
        if (t.startsWith("ENT:", ignoreCase = true) || !t.contains("-")) {
            lookupEntradaBenefit(t)
        } else {
            lookupSocio(extractUuid(t))
        }
    }

    private fun extractUuid(raw: String): String {
        val m = Regex("[0-9a-fA-F-]{36}").find(raw.trim())
        return m?.value ?: raw.trim()
    }

    private fun lookupSocio(uuid: String) {
        lifecycleScope.launch {
            try {
                val r = dash().salesRepo.socio(uuid)
                if (r.estado != "AL_DIA" || r.socio == null) {
                    toast("Socio no habilitado (${r.estado ?: "desconocido"})")
                    return@launch
                }
                dash().cart.setSocio(r.socio.id, r.socio.nombre ?: "", r.beneficios)
                refreshTotal()
                dash().refreshTotal()
                toast("Descuentos de ${r.socio.nombre} aplicados")
            } catch (e: Exception) {
                toast(e.message ?: "Socio no encontrado")
            }
        }
    }

    private fun lookupEntradaBenefit(raw: String) {
        lifecycleScope.launch {
            try {
                val v = dash().salesRepo.validarBeneficio(raw)
                if (!v.disponible || v.beneficio == null) {
                    toast(v.motivoNoDisponible ?: "Beneficio no disponible")
                    return@launch
                }
                val monto = computeEntradaDiscount(v) ?: run {
                    toast("El beneficio no aplica a este carrito")
                    return@launch
                }
                dash().cart.setEntradaDesc(
                    PosCart.EntradaDesc(
                        benefitCode = raw,
                        beneficioId = v.beneficio.id ?: "",
                        nombre = v.beneficio.nombre ?: "Beneficio entrada",
                        monto = monto,
                    ),
                )
                refreshTotal()
                dash().refreshTotal()
                toast("${v.beneficio.nombre} aplicado")
            } catch (e: Exception) {
                toast(e.message ?: "Código no válido")
            }
        }
    }

    /** % del beneficio sobre items elegibles (destino producto/categoría), con tope. */
    private fun computeEntradaDiscount(v: com.mposw.entradas.data.PosBenefitValidation): Double? {
        val b = v.beneficio ?: return null
        val pct = b.porcentaje?.toDoubleOrNull() ?: return null
        val cart = dash().cart
        var base = 0.0
        val dest = b.destino
        when {
            dest?.producto?.id != null -> {
                val line = cart.lines.find { it.product.id == dest.producto.id } ?: return null
                base = line.product.price * line.quantity
            }
            dest?.categoria?.id != null -> {
                base = cart.lines.filter { it.product.categoryId == dest.categoria.id }
                    .sumOf { it.product.price * it.quantity }
                if (base <= 0) return null
            }
            else -> return null // destino plan de internet: no aplica a la venta
        }
        var desc = base * pct / 100.0
        val tope = b.descuentoMaximo?.toDoubleOrNull()
        if (tope != null && desc > tope) desc = tope
        if (desc <= 0) return null
        return round(desc * 100) / 100
    }

    // ── Cobro ────────────────────────────────────────────
    private fun confirmCash() {
        if (busy) return
        val cart = dash().cart
        val received = cashInput.toDoubleOrNull() ?: 0.0
        if (received < cart.total) {
            b.tvPayError.text = "Monto insuficiente"
            return
        }
        busy = true
        lifecycleScope.launch {
            try {
                val sale = dash().salesRepo.cash(cart, received, round((received - cart.total) * 100) / 100)
                finalizeApproved(sale)
            } catch (e: Exception) {
                busy = false
                if (com.mposw.entradas.data.ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                if (isAdded) b.tvPayError.text = e.message ?: "Error cobrando"
            }
        }
    }

    private fun cobrarQr() {
        if (busy) return
        busy = true
        lifecycleScope.launch {
            try {
                val intent = dash().salesRepo.qr(dash().cart)
                val saleId = intent.saleId
                if (saleId.isNullOrBlank()) {
                    busy = false
                    if (isAdded) b.tvPayError.text = "No se pudo crear el cobro QR"
                    return@launch
                }
                dismissAllowingStateLoss()
                PosQrWaitDialog.new(saleId, dash().cart.total.toString()).show(parentFragmentManager, "posqr")
            } catch (e: Exception) {
                busy = false
                if (com.mposw.entradas.data.ApiClient.isWrongMode(e)) {
                    dismissAllowingStateLoss()
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    return@launch
                }
                if (isAdded) b.tvPayError.text = e.message ?: "Error creando QR"
            }
        }
    }

    /** Común a CASH y QR aprobado: imprime, registra y vuelve al dash. */
    suspend fun finalizeApproved(sale: PosSale) {
        dash().finalizeApproved(sale)
        if (isAdded) dismissAllowingStateLoss()
    }

    private fun toast(msg: String) {
        if (!isAdded) return
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

package com.mposw.entradas.ui.entradas

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.gson.Gson
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.AppDb
import com.mposw.entradas.data.ApprovedSale
import com.mposw.entradas.data.EntradasRepo
import com.mposw.entradas.data.FixtureVigente
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.FragmentVentaBinding
import com.mposw.entradas.printer.SunmiPrinter
import com.mposw.entradas.printer.TicketRenderer
import com.mposw.entradas.ui.BrandApplier
import com.mposw.entradas.ui.MainActivity
import com.mposw.entradas.ui.PagoExitosoDialogFragment
import com.mposw.entradas.ui.ScannerActivity
import kotlinx.coroutines.launch

class VentaFragment : Fragment() {
    private var _b: FragmentVentaBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager
    private lateinit var repo: EntradasRepo

    private var fixtures: List<FixtureVigente> = emptyList()
    private var sector: String = "LOCAL"
    private var cantidad: Int = 1
    private var socioUuid: String? = null
    private var busy: Boolean = false

    private val cameraPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val scanSocio = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents
        if (raw == null) {
            toast("Escaneo cancelado")
            return@registerForActivityResult
        }
        lookupSocio(extractUuid(raw))
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentVentaBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        repo = EntradasRepo(session)
        cameraPerm.launch(Manifest.permission.CAMERA)

        b.tgSector.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            sector = if (checkedId == b.btnLocal.id) "LOCAL" else "VISITANTE"
        }
        b.btnMinus.setOnClickListener { if (cantidad > 1) cantidad--; refreshTotal() }
        b.btnPlus.setOnClickListener { if (cantidad < 10) cantidad++; refreshTotal() }
        (activity as? MainActivity)?.setOnSocioClick(View.OnClickListener {
            if (socioUuid != null) {
                socioUuid = null
                (activity as? MainActivity)?.setSocioActive(false)
                toast("Socio quitado")
            } else {
                scanSocio.launch(ScanOptions().setPrompt("Escaneá la credencial del socio").setBeepEnabled(true).setCaptureActivity(ScannerActivity::class.java))
            }
        })
        b.btnCash.setOnClickListener { cobrar("CASH") }
        b.btnQr.setOnClickListener { cobrar("MP_QR") }
        parentFragmentManager.setFragmentResultListener("qr_aprobado", this) { _, bundle ->
            val fixtureId = bundle.getString("fixtureId") ?: return@setFragmentResultListener
            val sec = bundle.getString("sector") ?: return@setFragmentResultListener
            registrarVentaLocal(fixtureId, sec, bundle.getInt("cantidad", 0))
            refrescarUltimas()
            actualizarUltimos()
        }

        refreshSector()
        bindHeader()
        if (!session.isPaired) {
            toast("Sin vincular: andá a Config y escaneá el QR de pairing.")
        } else {
            cargarFixtures()
        }
        startModeTicker()
    }

    private var ticker: kotlinx.coroutines.Job? = null

    /** Re-pregunta el modo cada 60s solo con la venta visible. */
    private fun startModeTicker() {
        ticker?.cancel()
        ticker = viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    kotlinx.coroutines.delay(60_000L)
                    try {
                        (activity as? MainActivity)?.refreshMode()
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    private fun toast(msg: String) {
        if (!isAdded) return
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }

    private fun refreshSector() {
        b.tgSector.check(if (sector == "LOCAL") b.btnLocal.id else b.btnVisitante.id)
    }

    private fun clubLogoFile() = java.io.File(requireContext().filesDir, "club_logo.png")

    private fun showFallbackLogo(oneBit: android.graphics.Bitmap?) {
        if (oneBit != null) b.ivEscudo.setImageBitmap(oneBit)
        else b.ivEscudo.setImageResource(com.mposw.entradas.R.drawable.ic_shield)
    }

    private fun bindHeader() {
        // Prioridad: 1) logo del sistema (a color) 2) escudo 1-bit 3) placeholder
        val oneBit = SunmiPrinter.escudoBitmap(session.escudoBase64)
        val logoFile = clubLogoFile()
        val logoUrl = session.logoAbsoluteUrl()
        if (logoUrl != null && (session.logoCacheVersion != session.logoVersion || !logoFile.exists())) {
            showFallbackLogo(oneBit)
            lifecycleScope.launch { refreshClubLogo(logoFile, logoUrl, oneBit) }
        } else if (logoUrl != null && logoFile.exists()) {
            val bmp = android.graphics.BitmapFactory.decodeFile(logoFile.absolutePath)
            if (bmp != null) b.ivEscudo.setImageBitmap(bmp) else showFallbackLogo(oneBit)
        } else {
            showFallbackLogo(oneBit)
        }
        val fmt = java.text.SimpleDateFormat("EEE dd/MM · HH:mm", java.util.Locale("es", "AR"))
        b.tvFechaHora.text = fmt.format(java.util.Date())
        BrandApplier.apply(
            session.brandColor,
            null,
            emptyList(),
            listOf(b.btnCash, b.btnQr),
        )
    }

    private suspend fun refreshClubLogo(
        file: java.io.File,
        url: String,
        fallback: android.graphics.Bitmap?,
    ) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        try {
            val bmp = repo.downloadBitmap(url)
            if (bmp != null) {
                java.io.FileOutputStream(file).use { bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
                session.logoCacheVersion = session.logoVersion
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    _b?.ivEscudo?.setImageBitmap(bmp)
                }
            } else {
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    _b?.let { showFallbackLogo(fallback) }
                }
            }
        } catch (_: Exception) {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                _b?.let { showFallbackLogo(fallback) }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        _b?.let {
            bindHeader()
            actualizarTorneo()
            actualizarSectores()
            refreshTotal()
            refrescarUltimas()
            actualizarUltimos()
            (activity as? MainActivity)?.setSocioActive(socioUuid != null)
        }
    }

    private fun actualizarSectores() {
        val f = current()
        b.btnLocal.text = session.clubName.ifBlank { "Local" }
        b.btnVisitante.text = f?.rival?.ifBlank { "Visitante" } ?: "Visitante"
    }

    private fun actualizarTorneo() {
        b.tvTorneo.text = current()?.torneo.orEmpty()
    }

    private fun actualizarUltimos() {
        val f = current()
        if (f == null) {
            (activity as? MainActivity)?.setUltimosNumeros("")
            return
        }
        val l = "L-%03d".format(f.vendidosL.coerceAtLeast(0))
        val v = "V-%03d".format(f.vendidosV.coerceAtLeast(0))
        (activity as? MainActivity)?.setUltimosNumeros("$l - $v")
    }

    private fun registrarVentaLocal(fixtureId: String, sec: String, cant: Int) {
        if (cant <= 0) return
        fixtures = fixtures.map { fx ->
            if (fx.fixtureId != fixtureId) fx
            else if (sec == "LOCAL") fx.copy(vendidosL = fx.vendidosL + cant)
            else fx.copy(vendidosV = fx.vendidosV + cant)
        }
    }

    private fun refrescarUltimas() {
        lifecycleScope.launch {
            val ventas = try {
                AppDb.get(requireContext()).sales().lastFive()
            } catch (_: Exception) {
                emptyList()
            }
            val vb = _b ?: return@launch
            if (ventas.isEmpty()) {
                vb.llUltimasSection.visibility = View.GONE
                return@launch
            }
            vb.llUltimasSection.visibility = View.VISIBLE
            vb.llUltimasFilas.removeAllViews()
            for (v in ventas) {
                val p = try {
                    Gson().fromJson(v.payloadJson, com.mposw.entradas.data.StatusPayload::class.java)
                } catch (_: Exception) {
                    null
                }
                val sectorRaw = p?.datos?.sector
                    ?: p?.codigos?.firstOrNull()?.substringBefore("-")
                val lv = when {
                    sectorRaw.equals("LOCAL", ignoreCase = true) || sectorRaw == "L" -> "L"
                    sectorRaw.equals("VISITANTE", ignoreCase = true) || sectorRaw == "V" -> "V"
                    else -> sectorRaw?.take(1)?.uppercase() ?: "–"
                }
                val metodo = when (p?.paymentMethod) {
                    "CASH" -> "Efectivo"
                    "MP_QR" -> "QR"
                    else -> p?.paymentMethod ?: "–"
                }
                val row = layoutInflater.inflate(
                    com.mposw.entradas.R.layout.item_venta_reciente,
                    vb.llUltimasFilas,
                    false,
                )
                row.findViewById<TextView>(com.mposw.entradas.R.id.tvFilaHora).text =
                    horaDeVenta(p?.datos?.fechaPago, v.createdAt)
                row.findViewById<TextView>(com.mposw.entradas.R.id.tvFilaSector).text = lv
                row.findViewById<TextView>(com.mposw.entradas.R.id.tvFilaCantidad).text =
                    p?.cantidad?.takeIf { it > 0 }?.toString() ?: "–"
                row.findViewById<TextView>(com.mposw.entradas.R.id.tvFilaMetodo).text = metodo
                vb.llUltimasFilas.addView(row)
            }
        }
    }

    private fun horaDeVenta(fechaPagoIso: String?, createdAt: Long): String {
        val out = java.text.SimpleDateFormat("HH:mm", java.util.Locale("es", "AR"))
        if (!fechaPagoIso.isNullOrBlank()) {
            val s = fechaPagoIso.trim()
            val patrones = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX" to false,
                "yyyy-MM-dd'T'HH:mm:ssXXX" to false,
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" to true,
                "yyyy-MM-dd'T'HH:mm:ss'Z'" to true,
            )
            for ((pat, esZulu) in patrones) {
                try {
                    var txt = s
                    if (!esZulu && txt.endsWith("Z")) txt = txt.dropLast(1) + "+00:00"
                    if (esZulu && txt.endsWith("+00:00")) txt = txt.dropLast(6) + "Z"
                    val sdf = java.text.SimpleDateFormat(pat, java.util.Locale.US)
                    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                    val d = sdf.parse(txt) ?: continue
                    return out.format(d)
                } catch (_: Exception) {
                }
            }
        }
        return out.format(java.util.Date(createdAt))
    }

    private fun current(): FixtureVigente? {
        val pos = if (b.spFixture.adapter == null) -1 else b.spFixture.selectedItemPosition
        return fixtures.getOrNull(if (pos < 0) 0 else pos)
    }

    private val totalFmt =
        java.text.NumberFormat.getNumberInstance(java.util.Locale("es", "AR")).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }

    private fun refreshTotal() {
        val f = current()
        _b?.tvCantidad?.text = cantidad.toString()
        val total = (f?.precioDouble ?: 0.0) * cantidad
        (activity as? MainActivity)?.setBottomTotal("$${totalFmt.format(total)}")
    }

    private fun cargarFixtures() {
        lifecycleScope.launch {
            try {
                val r = repo.vigentes()
                fixtures = r.fixtures
                if (fixtures.isEmpty()) {
                    toast(getString(com.mposw.entradas.R.string.sin_partidos))
                    b.spFixture.adapter = null
                    actualizarTorneo()
                    actualizarSectores()
                    actualizarUltimos()
                } else {
                    b.spFixture.adapter = ArrayAdapter(
                        requireContext(),
                        android.R.layout.simple_spinner_dropdown_item,
                        fixtures,
                    )
                    b.spFixture.visibility = if (fixtures.size == 1) View.GONE else View.VISIBLE
                    b.spFixture.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(p: android.widget.AdapterView<*>?, v: View?, pos: Int, id: Long) {
                            refreshTotal()
                            actualizarTorneo()
                            actualizarSectores()
                            actualizarUltimos()
                        }
                        override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
                    }
                    actualizarTorneo()
                    actualizarSectores()
                }
                refreshTotal()
            } catch (e: Exception) {
                if (ApiClient.isWrongMode(e)) {
                    // El servidor cambió el modo: re-resuelve y cambia de pantalla solo.
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                } else {
                    toast(ApiClient.parseError(e))
                }
            }
        }
    }

    private fun extractUuid(raw: String): String {
        val t = raw.trim()
        if (t.contains("uuid", ignoreCase = true)) {
            return try {
                val m = Regex("[0-9a-fA-F-]{36}").find(t)
                m?.value ?: t
            } catch (_: Exception) { t }
        }
        return t
    }

    private fun lookupSocio(uuid: String) {
        if (uuid.isBlank()) return
        lifecycleScope.launch {
            try {
                val r = repo.socio(uuid)
                if (r.estado != "AL_DIA") {
                    socioUuid = null
                    (activity as? MainActivity)?.setSocioActive(false)
                    toast("Socio ${r.socio?.nombre ?: ""}: estado ${r.estado}. Sin descuento.")
                } else {
                    socioUuid = uuid
                    (activity as? MainActivity)?.setSocioActive(true)
                    toast("Socio ${r.socio?.nombre ?: ""} aplicado. El descuento lo confirma el servidor.")
                }
            } catch (e: Exception) {
                toast("Socio: ${ApiClient.parseError(e)}")
            }
        }
    }

    private fun cobrar(method: String) {
        val f = current()
        if (f == null) {
            toast("No hay partido vigente")
            return
        }
        if (busy) return
        busy = true
        lifecycleScope.launch {
            try {
                val (_, payload) = repo.intent(f.fixtureId, sector, cantidad, method, socioUuid)
                repo.syncTemplateIfNeeded(payload.templateVersion, payload.logoVersion)
                if (method == "CASH") {
                    if (payload.status == "APPROVED") {
                        guardarEImprimir(payload)
                        registrarVentaLocal(f.fixtureId, sector, cantidad)
                        refrescarUltimas()
                        actualizarUltimos()
                        socioUuid = null
                        (activity as? MainActivity)?.setSocioActive(false)
                        PagoExitosoDialogFragment.new(
                            (payload.codigos ?: emptyList()).joinToString(", "),
                            payload.total,
                        ).show(parentFragmentManager, "ok")
                    } else {
                        toast("Estado inesperado: ${payload.status}")
                    }
                } else {
                    val qrUrl = payload.qrImageUrl ?: payload.datos?.qrImageUrl
                    if (payload.saleId == null || qrUrl.isNullOrBlank()) {
                        toast("QR no configurado en el servidor (qrImageUrl vacío).")
                    } else {
                        val total = payload.total ?: totalFmt.format(f.precioDouble * cantidad)
                        QrPagoFragment.new(payload.saleId, qrUrl, total, f.fixtureId, sector, cantidad)
                            .show(parentFragmentManager, "qr")
                    }
                }
            } catch (e: Exception) {
                toast(ApiClient.parseError(e))
            } finally {
                busy = false
            }
        }
    }

    private suspend fun guardarEImprimir(payload: com.mposw.entradas.data.StatusPayload) {
        val json = Gson().toJson(payload)
        payload.saleId?.let { AppDb.get(requireContext()).sales().upsert(ApprovedSale(it, json)) }
        val elements = TicketRenderer.parseTemplate(session.templateJson)
        val escudo = SunmiPrinter.escudoBitmap(session.escudoBase64)
        val res = SunmiPrinter.printSale(requireContext(), payload, elements, escudo)
        if (res.isSuccess) {
            toast("APROBADA ${(payload.codigos ?: emptyList()).joinToString(", ")} · $${payload.total}")
        } else {
            toast("APROBADA pero sin imprimir: ${(payload.codigos ?: emptyList()).joinToString(", ")}")
        }
    }

    override fun onDestroyView() {
        ticker?.cancel()
        ticker = null
        (activity as? MainActivity)?.setOnSocioClick(null)
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(): VentaFragment = VentaFragment()
    }
}

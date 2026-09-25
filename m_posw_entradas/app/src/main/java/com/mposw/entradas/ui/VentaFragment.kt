package com.mposw.entradas.ui

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
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
        val raw = result.contents ?: return@registerForActivityResult
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
                scanSocio.launch(ScanOptions().setPrompt("Escaneá la credencial del socio").setBeepEnabled(true))
            }
        })
        b.btnCash.setOnClickListener { cobrar("CASH") }
        b.btnQr.setOnClickListener { cobrar("MP_QR") }
        parentFragmentManager.setFragmentResultListener("qr_aprobado", this) { _, bundle ->
            val fixtureId = bundle.getString("fixtureId") ?: return@setFragmentResultListener
            val sec = bundle.getString("sector") ?: return@setFragmentResultListener
            registrarVentaLocal(fixtureId, sec, bundle.getInt("cantidad", 0))
        }

        refreshSector()
        bindHeader()
        if (!session.isPaired) {
            toast("Sin vincular: andá a Config y escaneá el QR de pairing.")
        } else {
            cargarFixtures()
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

    private fun registrarVentaLocal(fixtureId: String, sec: String, cant: Int) {
        if (cant <= 0) return
        fixtures = fixtures.map { fx ->
            if (fx.fixtureId != fixtureId) fx
            else if (sec == "LOCAL") fx.copy(vendidosL = fx.vendidosL + cant)
            else fx.copy(vendidosV = fx.vendidosV + cant)
        }
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
        (activity as? MainActivity)?.setBottomTotal("$$${totalFmt.format(total)}")
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
                        }
                        override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
                    }
                    actualizarTorneo()
                    actualizarSectores()
                }
                refreshTotal()
            } catch (e: Exception) {
                toast(ApiClient.parseError(e))
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
        (activity as? MainActivity)?.setOnSocioClick(null)
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(): VentaFragment = VentaFragment()
    }
}

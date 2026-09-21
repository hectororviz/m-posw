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
        b.btnSocio.setOnClickListener {
            scanSocio.launch(ScanOptions().setPrompt("Escaneá la credencial del socio").setBeepEnabled(true))
        }
        b.btnQuitarSocio.setOnClickListener { socioUuid = null; b.tvSocio.text = "" }
        b.btnCash.setOnClickListener { cobrar("CASH") }
        b.btnQr.setOnClickListener { cobrar("MP_QR") }
        b.btnReprint.setOnClickListener { reimprimir() }

        refreshSector()
        bindHeader()
        if (!session.isPaired) {
            b.tvStatus.text = "Sin vincular: andá a Config y escaneá el QR de pairing."
        } else {
            cargarFixtures()
        }
    }

    private fun refreshSector() {
        b.tgSector.check(if (sector == "LOCAL") b.btnLocal.id else b.btnVisitante.id)
    }

    private fun bindHeader() {
        val bmp = SunmiPrinter.escudoBitmap(session.escudoBase64)
        if (bmp != null) b.ivEscudo.setImageBitmap(bmp)
        else b.ivEscudo.setImageResource(com.mposw.entradas.R.drawable.ic_shield)
        b.tvClub.text = session.clubName.ifBlank { "Entradas" }
        val fmt = java.text.SimpleDateFormat("EEE dd/MM · HH:mm", java.util.Locale("es", "AR"))
        b.tvFechaHora.text = fmt.format(java.util.Date())
        BrandApplier.apply(
            session.brandColor,
            b.cardHeader,
            listOf(b.tvClub, b.tvFechaHora),
            listOf(b.btnCash, b.btnQr),
        )
    }

    override fun onResume() {
        super.onResume()
        _b?.let { bindHeader() }
    }

    private fun current(): FixtureVigente? {
        val pos = if (b.spFixture.adapter == null) -1 else b.spFixture.selectedItemPosition
        return fixtures.getOrNull(if (pos < 0) 0 else pos)
    }

    private fun refreshTotal() {
        val f = current()
        b.tvCantidad.text = cantidad.toString()
        val total = (f?.precioDouble ?: 0.0) * cantidad
        b.tvTotal.text = "$${"%.2f".format(total)}"
    }

    private fun cargarFixtures() {
        lifecycleScope.launch {
            try {
                b.tvStatus.text = "Cargando partidos…"
                val r = repo.vigentes()
                fixtures = r.fixtures
                if (fixtures.isEmpty()) {
                    b.tvStatus.text = getString(com.mposw.entradas.R.string.sin_partidos)
                    b.spFixture.adapter = null
                    b.tvFixtureInfo.text = ""
                } else {
                    b.spFixture.adapter = ArrayAdapter(
                        requireContext(),
                        android.R.layout.simple_spinner_dropdown_item,
                        fixtures,
                    )
                    val f = fixtures[0]
                    b.tvFixtureInfo.text = "${f.torneo} vs ${f.rival} · $${f.precio}"
                    b.spFixture.visibility = if (fixtures.size == 1) View.GONE else View.VISIBLE
                    b.tvStatus.text = ""
                    b.spFixture.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(p: android.widget.AdapterView<*>?, v: View?, pos: Int, id: Long) {
                            val fx = fixtures[pos]
                            b.tvFixtureInfo.text = "${fx.torneo} vs ${fx.rival} · $${fx.precio}"
                            refreshTotal()
                        }
                        override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
                    }
                }
                refreshTotal()
            } catch (e: Exception) {
                b.tvStatus.text = ApiClient.parseError(e)
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
                b.tvStatus.text = "Consultando socio…"
                val r = repo.socio(uuid)
                if (r.estado != "AL_DIA") {
                    b.tvStatus.text = "Socio ${r.socio?.nombre ?: ""}: estado ${r.estado}. Sin descuento."
                    socioUuid = null
                    b.tvSocio.text = ""
                } else {
                    socioUuid = uuid
                    b.tvSocio.text = "${r.socio?.nombre} · ${r.socio?.nroSocio} · AL DÍA"
                    b.tvStatus.text = "Socio aplicado. El descuento lo confirma el servidor."
                }
            } catch (e: Exception) {
                b.tvStatus.text = "Socio: ${ApiClient.parseError(e)}"
            }
        }
    }

    private fun cobrar(method: String) {
        val f = current()
        if (f == null) {
            Toast.makeText(requireContext(), "No hay partido vigente", Toast.LENGTH_SHORT).show()
            return
        }
        if (busy) return
        busy = true
        lifecycleScope.launch {
            try {
                b.tvStatus.text = "Enviando…"
                val (_, payload) = repo.intent(f.fixtureId, sector, cantidad, method, socioUuid)
                repo.syncTemplateIfNeeded(payload.templateVersion, payload.logoVersion)
                if (method == "CASH") {
                    if (payload.status == "APPROVED") {
                        guardarEImprimir(payload)
                        socioUuid = null
                        b.tvSocio.text = ""
                    } else {
                        b.tvStatus.text = "Estado inesperado: ${payload.status}"
                    }
                } else {
                    val qrUrl = payload.qrImageUrl ?: payload.datos?.qrImageUrl
                    if (payload.saleId == null || qrUrl.isNullOrBlank()) {
                        b.tvStatus.text = "QR no configurado en el servidor (qrImageUrl vacío)."
                    } else {
                        QrPagoFragment.new(payload.saleId, qrUrl, payload.total)
                            .show(parentFragmentManager, "qr")
                    }
                }
            } catch (e: Exception) {
                b.tvStatus.text = ApiClient.parseError(e)
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
        b.tvStatus.text = if (res.isSuccess) {
            "APROBADA ${payload.codigos.joinToString(", ")} · $${payload.total}"
        } else {
            "APROBADA pero sin imprimir. Usá Reimprimir. ${payload.codigos.joinToString(", ")}"
        }
    }

    private fun reimprimir() {
        lifecycleScope.launch {
            val last = AppDb.get(requireContext()).sales().last()
            if (last == null) {
                Toast.makeText(requireContext(), "No hay ventas guardadas", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val payload = repo.payloadFromJson(last.payloadJson) ?: return@launch
            val elements = TicketRenderer.parseTemplate(session.templateJson)
            val escudo = SunmiPrinter.escudoBitmap(session.escudoBase64)
            val res = SunmiPrinter.printSale(requireContext(), payload, elements, escudo)
            b.tvStatus.text = if (res.isSuccess) "Reimpresa ${payload.codigos.joinToString(", ")}"
            else "No se pudo imprimir. Revisá papel/impresora."
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun new(): VentaFragment = VentaFragment()
    }
}

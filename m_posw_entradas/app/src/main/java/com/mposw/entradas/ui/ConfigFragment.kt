package com.mposw.entradas.ui

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.EntradasRepo
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.FragmentConfigBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class ConfigFragment : Fragment() {
    private var _b: FragmentConfigBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager

    private val cameraPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val scanPairing = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents ?: return@registerForActivityResult
        try {
            val o = JSONObject(raw)
            val base = o.optString("baseUrl", "")
            val tok = o.optString("token", "")
            if (base.isNotBlank() && tok.isNotBlank()) {
                session.baseUrl = SessionManager.normalizeBaseUrl(base)
                session.token = tok
                b.etBaseUrl.setText(session.baseUrl)
                b.etToken.setText(session.token)
                b.tvConfigStatus.text = "Pairing guardado. Probá la conexión."
            } else {
                b.tvConfigStatus.text = "QR inválido: se esperaba {baseUrl, token}."
            }
        } catch (_: Exception) {
            b.tvConfigStatus.text = "QR inválido."
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentConfigBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        cameraPerm.launch(Manifest.permission.CAMERA)
        b.etBaseUrl.setText(session.baseUrl)
        b.etToken.setText(session.token)
        refreshVersions()

        b.btnScanPairing.setOnClickListener {
            scanPairing.launch(ScanOptions().setPrompt("Escaneá el QR de pairing").setBeepEnabled(true))
        }
        b.btnSave.setOnClickListener {
            session.baseUrl = SessionManager.normalizeBaseUrl(b.etBaseUrl.text.toString())
            session.token = b.etToken.text.toString().trim()
            b.tvConfigStatus.text = if (session.isPaired) "Guardado." else "Falta baseUrl o token ent_…"
            refreshVersions()
        }
        b.btnTest.setOnClickListener { probar() }
        b.btnVolver.setOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }
    }

    private fun refreshVersions() {
        b.tvVersions.text = "template v${session.templateVersion} · escudo v${session.logoVersion}"
    }

    private fun probar() {
        lifecycleScope.launch {
            try {
                b.tvConfigStatus.text = "Probando…"
                val repo = EntradasRepo(session)
                val r = repo.vigentes()
                repo.syncTemplateForce()
                refreshVersions()
                b.tvConfigStatus.text = "OK: ${r.fixtures.size} partido(s) vigente(s)."
            } catch (e: Exception) {
                val msg = e.message ?: ""
                if (msg.contains("401") || msg.contains("DEVICE_REVOKED")) {
                    session.clearToken()
                    b.etToken.setText("")
                    b.tvConfigStatus.text = "Token revocado. Re-vinculá el equipo."
                } else {
                    b.tvConfigStatus.text = ApiClient.parseError(e)
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

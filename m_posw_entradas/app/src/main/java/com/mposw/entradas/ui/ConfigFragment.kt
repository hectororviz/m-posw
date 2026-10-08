package com.mposw.entradas.ui

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatDelegate
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.DeviceMode
import com.mposw.entradas.data.EntradasRepo
import com.mposw.entradas.data.ModeResolver
import com.mposw.entradas.data.ModeResult
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
        val raw = result.contents
        if (raw == null) {
            if (isAdded) android.widget.Toast.makeText(requireContext(), "Escaneo cancelado", android.widget.Toast.LENGTH_SHORT).show()
            return@registerForActivityResult
        }
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
            scanPairing.launch(ScanOptions().setPrompt("Escaneá el QR de pairing").setBeepEnabled(true).setCaptureActivity(ScannerActivity::class.java))
        }
        b.btnSave.setOnClickListener {
            session.baseUrl = SessionManager.normalizeBaseUrl(b.etBaseUrl.text.toString())
            session.token = b.etToken.text.toString().trim()
            b.tvConfigStatus.text = if (session.isPaired) "Guardado." else "Falta baseUrl o token ent_…"
            refreshVersions()
        }
        b.btnTest.setOnClickListener { probar() }
        b.btnVolver.setOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }

        when (session.themeMode) {
            "light" -> b.tgTheme.check(b.btnThemeLight.id)
            "dark" -> b.tgTheme.check(b.btnThemeDark.id)
            else -> b.tgTheme.check(b.btnThemeSystem.id)
        }
        b.tgTheme.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val mode = when (checkedId) {
                b.btnThemeLight.id -> "light"
                b.btnThemeDark.id -> "dark"
                else -> "system"
            }
            session.themeMode = mode
            AppCompatDelegate.setDefaultNightMode(
                when (mode) {
                    "light" -> AppCompatDelegate.MODE_NIGHT_NO
                    "dark" -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                },
            )
        }

        when (session.textScale) {
            "S" -> b.tgTextScale.check(b.btnScaleS.id)
            "L" -> b.tgTextScale.check(b.btnScaleL.id)
            else -> b.tgTextScale.check(b.btnScaleM.id)
        }
        b.tgTextScale.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            session.textScale = when (checkedId) {
                b.btnScaleS.id -> "S"
                b.btnScaleL.id -> "L"
                else -> "M"
            }
            session.scaleDirty = true
        }
    }

    private fun refreshVersions() {
        val app = "v${com.mposw.entradas.BuildConfig.VERSION_NAME} (${com.mposw.entradas.BuildConfig.GIT_SHA})"
        b.tvVersions.text = "$app · modo ${session.deviceMode} · template v${session.templateVersion} · escudo v${session.logoVersion}"
    }

    private fun probar() {
        lifecycleScope.launch {
            try {
                b.tvConfigStatus.text = "Probando…"
                // El modo lo define el servidor; se guarda sin re-pairing.
                // Sin conexión y sin modo conocido, la app queda en Config.
                val mode = when (val m = ModeResolver(session).resolve()) {
                    is ModeResult.Ok -> m.mode
                    is ModeResult.Offline -> {
                        if (m.lastKnown == DeviceMode.UNKNOWN) {
                            b.tvConfigStatus.text = "Sin conexión y sin modo conocido. Queda en Configuración."
                            return@launch
                        }
                        m.lastKnown
                    }
                    ModeResult.Revoked -> {
                        b.etToken.setText("")
                        b.tvConfigStatus.text = "Token revocado. Re-vinculá el equipo."
                        return@launch
                    }
                }
                refreshVersions()
                if (mode == DeviceMode.POS) {
                    // vigentes()/template son solo de entradas (403 en POS).
                    b.tvConfigStatus.text = "OK. Modo: POS."
                    (activity as? MainActivity)?.enterModeIfRoot(mode)
                    return@launch
                }
                val repo = EntradasRepo(session)
                val r = repo.vigentes()
                repo.syncTemplateForce()
                refreshVersions()
                b.tvConfigStatus.text = "OK: ${r.fixtures.size} partido(s) vigente(s). Modo: ${mode.name}."
                (activity as? MainActivity)?.enterModeIfRoot(mode)
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

package com.mposw.entradas.ui.config

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.mposw.entradas.BuildConfig
import com.mposw.entradas.data.ApiClient
import com.mposw.entradas.data.DeviceMode
import com.mposw.entradas.data.EntradasRepo
import com.mposw.entradas.data.ModeResolver
import com.mposw.entradas.data.ModeResult
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.TabConfigEstadoBinding
import com.mposw.entradas.printer.PrinterRouter
import com.mposw.entradas.ui.MainActivity
import com.mposw.entradas.util.DialogStyle
import kotlinx.coroutines.launch

/** Pestaña Estado: resumen + Probar conexión (navega al modo si es raíz). */
class ConfigEstadoFragment : Fragment() {
    private var _b: TabConfigEstadoBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = TabConfigEstadoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        DialogStyle.centerContentWide(b.root)
        b.btnTest.setOnClickListener { probar() }
        refreshEstado()
    }

    override fun onResume() {
        super.onResume()
        if (_b != null && isAdded) refreshEstado()
    }

    private fun refreshEstado() {
        if (_b == null || !isAdded) return
        b.tvEstadoModo.text = "Modo: ${session.deviceMode}"
        b.tvEstadoServidor.text = "Servidor: ${session.baseUrl.ifBlank { "sin configurar" }}"
        b.tvEstadoImpresora.text = "Impresora: ${PrinterRouter.describe(requireContext())}"
        refreshVersions()
    }

    private fun refreshVersions() {
        if (_b == null) return
        b.tvVersions.text = versionText()
    }

    private fun versionText(): String {
        val app = "v${BuildConfig.VERSION_NAME} (${BuildConfig.GIT_SHA})"
        return "$app · modo ${session.deviceMode} · template v${session.templateVersion} · escudo v${session.logoVersion} · fotos ${session.imgLocal}/${session.imgTotal} · ${session.imgMb} MB"
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
                        b.tvConfigStatus.text = "Token revocado. Re-vinculá el equipo en la pestaña Conexión."
                        return@launch
                    }
                }
                refreshEstado()
                if (mode == DeviceMode.POS) {
                    // vigentes()/template son solo de entradas (403 en POS).
                    b.tvConfigStatus.text = "OK. Modo: POS."
                    (activity as? MainActivity)?.enterModeIfRoot(mode)
                    return@launch
                }
                val repo = EntradasRepo(session)
                val r = repo.vigentes()
                repo.syncTemplateForce()
                refreshEstado()
                b.tvConfigStatus.text = "OK: ${(r.fixtures ?: emptyList()).size} partido(s) vigente(s). Modo: ${mode.name}."
                (activity as? MainActivity)?.enterModeIfRoot(mode)
            } catch (e: Exception) {
                if (!isAdded || _b == null) return@launch
                val msg = e.message ?: ""
                if (msg.contains("401") || msg.contains("DEVICE_REVOKED")) {
                    session.clearToken()
                    b.tvConfigStatus.text = "Token revocado. Re-vinculá el equipo en la pestaña Conexión."
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

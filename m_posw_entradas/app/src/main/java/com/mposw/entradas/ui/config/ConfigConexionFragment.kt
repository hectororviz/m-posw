package com.mposw.entradas.ui.config

import android.Manifest
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.TabConfigConexionBinding
import com.mposw.entradas.ui.ScannerActivity
import com.mposw.entradas.util.DialogStyle
import org.json.JSONObject

/** Pestaña Conexión: URL + token + pairing QR. */
class ConfigConexionFragment : Fragment() {
    private var _b: TabConfigConexionBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager

    private val cameraPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val scanPairing = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents
        if (raw == null) {
            if (isAdded) Toast.makeText(requireContext(), "Escaneo cancelado", Toast.LENGTH_SHORT).show()
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
                b.tvConnStatus.text = "Pairing guardado. Probá la conexión en la pestaña Estado."
            } else {
                b.tvConnStatus.text = "QR inválido: se esperaba {baseUrl, token}."
            }
        } catch (_: Exception) {
            b.tvConnStatus.text = "QR inválido."
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = TabConfigConexionBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        cameraPerm.launch(Manifest.permission.CAMERA)
        DialogStyle.centerContentWide(b.root)
        b.etBaseUrl.setText(session.baseUrl)
        b.etToken.setText(session.token)
        b.btnScanPairing.setOnClickListener {
            scanPairing.launch(ScanOptions().setPrompt("Escaneá el QR de pairing").setBeepEnabled(true).setCaptureActivity(ScannerActivity::class.java))
        }
        b.btnSave.setOnClickListener {
            session.baseUrl = SessionManager.normalizeBaseUrl(b.etBaseUrl.text.toString())
            session.token = b.etToken.text.toString().trim()
            b.tvConnStatus.text = if (session.isPaired) "Guardado." else "Falta baseUrl o token ent_…"
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

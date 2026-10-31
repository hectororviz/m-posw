package com.mposw.entradas.ui.config

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.TabConfigImpresoraBinding
import com.mposw.entradas.printer.BluetoothPrinter
import com.mposw.entradas.printer.PrintBlock
import com.mposw.entradas.printer.PrinterRouter
import com.mposw.entradas.util.DialogStyle
import kotlinx.coroutines.launch

/** Pestaña Impresora: gestión Bluetooth (en Sunmi informa la integrada). */
class ConfigImpresoraFragment : Fragment() {
    private var _b: TabConfigImpresoraBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager

    private val btPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        // Con o sin permiso se muestra el diálogo: sin permiso explica cómo emparejar.
        if (isAdded) showPrinterDialog()
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = TabConfigImpresoraBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        DialogStyle.centerContentWide(b.root)
        refreshPrinterStatus()
        b.btnPrinterChoose.setOnClickListener { elegirImpresora() }
        b.btnPrinterForget.setOnClickListener {
            session.printerMac = ""
            session.printerName = ""
            refreshPrinterStatus()
            b.tvPrinterMsg.text = "Impresora olvidada."
        }
        b.btnPrinterTest.setOnClickListener { imprimirPrueba() }
        b.btnBtSettings.setOnClickListener { abrirAjustesBt() }
    }

    override fun onResume() {
        super.onResume()
        if (_b != null && isAdded) refreshPrinterStatus()
    }

    private fun refreshPrinterStatus() {
        if (_b == null || !isAdded) return
        b.tvPrinterStatus.text = PrinterRouter.describe(requireContext())
    }

    private fun elegirImpresora() {
        if (PrinterRouter.isSunmiDevice(requireContext())) {
            b.tvPrinterMsg.text = "Este equipo usa su impresora integrada."
            return
        }
        val faltantes = BluetoothPrinter.missingPermissions(requireContext())
        if (faltantes.isNotEmpty()) {
            btPerm.launch(faltantes.toTypedArray())
            return
        }
        showPrinterDialog()
    }

    private fun showPrinterDialog() {
        if (!isAdded || _b == null) return
        val devices = BluetoothPrinter.pairedDevices(requireContext())
        if (devices.isEmpty()) {
            MaterialAlertDialogBuilder(requireContext())
                .setTitle("Elegir impresora")
                .setMessage("No hay impresoras emparejadas. Emparejá la impresora en los ajustes Bluetooth del sistema y volvé a elegir.")
                .setPositiveButton("Abrir ajustes") { _, _ -> abrirAjustesBt() }
                .setNegativeButton("Cerrar", null)
                .show()
            return
        }
        val names = devices.map { "${it.name}\n${it.mac}" }.toTypedArray()
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Elegir impresora")
            .setItems(names) { _, which ->
                session.printerMac = devices[which].mac
                session.printerName = devices[which].name
                refreshPrinterStatus()
                b.tvPrinterMsg.text = "Impresora: ${devices[which].name}."
            }
            .setNegativeButton("Cerrar", null)
            .show()
    }

    private fun imprimirPrueba() {
        b.tvPrinterMsg.text = "Imprimiendo prueba…"
        lifecycleScope.launch {
            val res = PrinterRouter.printBlocks(
                requireContext(),
                null,
                listOf(
                    PrintBlock.Text("PRUEBA DE IMPRESION", 28f, true),
                    PrintBlock.Line,
                    PrintBlock.Text(PrinterRouter.describe(requireContext()), 24f, false),
                    PrintBlock.Feed,
                ),
            )
            if (!isAdded || _b == null) return@launch
            b.tvPrinterMsg.text = res.fold(
                { "Prueba OK." },
                { "Prueba falló: ${it.message}" },
            )
        }
    }

    private fun abrirAjustesBt() {
        try {
            startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
        } catch (_: Exception) {
            if (isAdded) Toast.makeText(requireContext(), "No se pudo abrir ajustes Bluetooth", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

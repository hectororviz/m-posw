package com.mposw.entradas.ui

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.mposw.entradas.R
import com.mposw.entradas.data.DeviceMode
import com.mposw.entradas.data.ModeResolver
import com.mposw.entradas.data.ModeResult
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.printer.SunmiPrinter
import com.mposw.entradas.ui.entradas.VentaFragment
import com.mposw.entradas.ui.pos.PosDashFragment
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var bottomBar: LinearLayout
    private lateinit var ultimosBar: LinearLayout
    private lateinit var btnConfig: ImageButton
    private lateinit var btnSocioBottom: MaterialButton
    private lateinit var tvTotalBottom: TextView
    private lateinit var tvChipLocal: TextView
    private lateinit var tvChipVisitante: TextView
    private lateinit var session: SessionManager

    private var currentMode: DeviceMode? = null
    private var resolving = false

    override fun onCreate(savedInstanceState: Bundle?) {
        applySavedTheme()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        session = SessionManager(this)
        // Común a ambos modos (impresora integrada). Nada de Room ni de
        // pantallas de un modo se inicializa acá.
        SunmiPrinter.init(this)
        bottomBar = findViewById(R.id.bottomBar)
        ultimosBar = findViewById(R.id.ultimosBar)
        btnConfig = findViewById(R.id.btnConfig)
        btnSocioBottom = findViewById(R.id.btnSocioBottom)
        tvTotalBottom = findViewById(R.id.tvTotalBottom)
        tvChipLocal = findViewById(R.id.tvChipLocal)
        tvChipVisitante = findViewById(R.id.tvChipVisitante)

        if (savedInstanceState == null) {
            refreshMode()
        }
        btnConfig.setOnClickListener { showConfig() }
        supportFragmentManager.addOnBackStackChangedListener { syncGear() }
        syncGear()
    }

    override fun onResume() {
        super.onResume()
        // Al volver a primer plano, el servidor pudo haber cambiado el modo.
        if (supportFragmentManager.backStackEntryCount == 0 && session.isPaired) {
            refreshMode()
        }
    }

    /**
     * Re-consulta GET devices/me y muestra la pantalla del modo asignado.
     * Pública: los fragments la llaman ante 403 DEVICE_WRONG_MODE para
     * cambiar de pantalla solos, sin cerrar la app.
     */
    fun refreshMode() {
        if (resolving) return
        // Sin servidor que valide el modo, la app queda en Configuración.
        if (!session.isPaired) {
            showConfigRoot()
            return
        }
        resolving = true
        lifecycleScope.launch {
            try {
                when (val r = ModeResolver(session).resolve()) {
                    is ModeResult.Ok -> showMode(r.mode)
                    is ModeResult.Offline -> {
                        if (r.lastKnown == DeviceMode.UNKNOWN) showConfigRoot()
                        else showMode(r.lastKnown)
                    }
                    ModeResult.Revoked -> showConfig()
                }
            } finally {
                resolving = false
            }
        }
    }

    /** Config como pantalla raíz (sin back): el equipo aún no tiene modo. */
    private fun showConfigRoot() {
        val current = supportFragmentManager.findFragmentById(R.id.nav_host)
        if (current is ConfigFragment && supportFragmentManager.backStackEntryCount == 0) return
        currentMode = null
        supportFragmentManager.popBackStackImmediate(null, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host, ConfigFragment())
            .commit()
        syncGear()
    }

    private fun showMode(mode: DeviceMode) {
        if (mode == currentMode && supportFragmentManager.backStackEntryCount == 0) return
        currentMode = mode
        // Al cambiar de modo se limpia el back stack (p. ej. Config abierta).
        supportFragmentManager.popBackStackImmediate(null, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
        val fragment: Fragment = if (mode == DeviceMode.POS) PosDashFragment() else VentaFragment()
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host, fragment)
            .commit()
        syncGear()
    }

    private fun showConfig() {
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host, ConfigFragment())
            .addToBackStack(null)
            .commit()
    }

    /** Abre Config con back (engranaje del dash POS, por ejemplo). */
    fun openConfig() = showConfig()

    /**
     * Tras "Probar conexión" exitoso: si Config es raíz (equipo sin modo),
     * navega a la pantalla del modo. Desde el engranaje no navega.
     */
    fun enterModeIfRoot(mode: DeviceMode) {
        val current = supportFragmentManager.findFragmentById(R.id.nav_host)
        if (current is ConfigFragment && supportFragmentManager.backStackEntryCount == 0) {
            showMode(mode)
        }
    }

    private fun syncGear() {
        // La barra inferior (socio + total + últimos) es exclusiva de entradas
        // con modo asignado. En Config raíz o modo POS se oculta.
        val inHome = supportFragmentManager.backStackEntryCount == 0
        val isEntradas = currentMode == DeviceMode.ENTRADAS
        bottomBar.visibility = if (inHome && isEntradas) View.VISIBLE else View.GONE
        ultimosBar.visibility =
            if (inHome && isEntradas && (tvChipLocal.text.isNotBlank() || tvChipVisitante.text.isNotBlank())) View.VISIBLE else View.GONE
    }

    fun setUltimosNumeros(local: Int, visitante: Int) {
        if (!::tvChipLocal.isInitialized) return
        tvChipLocal.text = "Local $local"
        tvChipVisitante.text = "Visitante $visitante"
        if (::ultimosBar.isInitialized) {
            val inHome = supportFragmentManager.backStackEntryCount == 0
            ultimosBar.visibility =
                if (inHome && currentMode == DeviceMode.ENTRADAS) View.VISIBLE else View.GONE
        }
    }

    fun clearUltimosNumeros() {
        if (!::tvChipLocal.isInitialized) return
        tvChipLocal.text = ""
        tvChipVisitante.text = ""
        if (::ultimosBar.isInitialized) ultimosBar.visibility = View.GONE
    }

    private fun applySavedTheme() {
        when (SessionManager(this).themeMode) {
            "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            else -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        }
    }

    fun setBottomTotal(text: String) {
        if (::tvTotalBottom.isInitialized) tvTotalBottom.text = text
    }

    fun setOnSocioClick(listener: View.OnClickListener?) {
        if (::btnSocioBottom.isInitialized) btnSocioBottom.setOnClickListener(listener)
    }

    fun setSocioActive(active: Boolean) {
        if (!::btnSocioBottom.isInitialized) return
        btnSocioBottom.isChecked = active
        btnSocioBottom.alpha = if (active) 1f else 0.85f
        val desc = if (active) getString(R.string.socio_quitar) else getString(R.string.socio_escanear)
        btnSocioBottom.contentDescription = desc
        if (android.os.Build.VERSION.SDK_INT >= 26) btnSocioBottom.tooltipText = desc
    }
}

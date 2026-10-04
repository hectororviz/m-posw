package com.mposw.entradas.ui

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.google.android.material.button.MaterialButton
import com.mposw.entradas.R
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.printer.SunmiPrinter

class MainActivity : AppCompatActivity() {
    private lateinit var bottomBar: LinearLayout
    private lateinit var ultimosBar: LinearLayout
    private lateinit var btnConfig: ImageButton
    private lateinit var btnSocioBottom: MaterialButton
    private lateinit var tvTotalBottom: TextView
    private lateinit var tvUltimosNumeros: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        applySavedTheme()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        SunmiPrinter.init(this)
        bottomBar = findViewById(R.id.bottomBar)
        ultimosBar = findViewById(R.id.ultimosBar)
        btnConfig = findViewById(R.id.btnConfig)
        btnSocioBottom = findViewById(R.id.btnSocioBottom)
        tvTotalBottom = findViewById(R.id.tvTotalBottom)
        tvUltimosNumeros = findViewById(R.id.tvUltimosNumeros)

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.nav_host, VentaFragment())
                .commit()
        }
        btnConfig.setOnClickListener { showConfig() }
        supportFragmentManager.addOnBackStackChangedListener { syncGear() }
        syncGear()
    }

    private fun showConfig() {
        supportFragmentManager.beginTransaction()
            .replace(R.id.nav_host, ConfigFragment())
            .addToBackStack(null)
            .commit()
    }

    private fun syncGear() {
        val inVenta = supportFragmentManager.backStackEntryCount == 0
        bottomBar.visibility = if (inVenta) View.VISIBLE else View.GONE
        ultimosBar.visibility =
            if (inVenta && tvUltimosNumeros.text.isNotBlank()) View.VISIBLE else View.GONE
    }

    fun setUltimosNumeros(text: String) {
        if (!::tvUltimosNumeros.isInitialized) return
        tvUltimosNumeros.text = text
        if (::ultimosBar.isInitialized) {
            val inVenta = supportFragmentManager.backStackEntryCount == 0
            ultimosBar.visibility =
                if (inVenta && text.isNotBlank()) View.VISIBLE else View.GONE
        }
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
    }
}

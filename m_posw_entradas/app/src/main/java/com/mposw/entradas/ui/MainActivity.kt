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
    private lateinit var btnConfig: ImageButton
    private lateinit var btnSocioBottom: MaterialButton
    private lateinit var tvTotalBottom: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        applySavedTheme()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        SunmiPrinter.init(this)
        bottomBar = findViewById(R.id.bottomBar)
        btnConfig = findViewById(R.id.btnConfig)
        btnSocioBottom = findViewById(R.id.btnSocioBottom)
        tvTotalBottom = findViewById(R.id.tvTotalBottom)

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
        bottomBar.visibility =
            if (supportFragmentManager.backStackEntryCount == 0) View.VISIBLE else View.GONE
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

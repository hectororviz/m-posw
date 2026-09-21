package com.mposw.entradas.ui

import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import com.mposw.entradas.R
import com.mposw.entradas.printer.SunmiPrinter

class MainActivity : AppCompatActivity() {
    private lateinit var bottomBar: LinearLayout
    private lateinit var btnConfig: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        SunmiPrinter.init(this)
        bottomBar = findViewById(R.id.bottomBar)
        btnConfig = findViewById(R.id.btnConfig)

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
}

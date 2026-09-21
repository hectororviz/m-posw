package com.mposw.entradas.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.mposw.entradas.R
import com.mposw.entradas.printer.SunmiPrinter

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        SunmiPrinter.init(this)

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.nav_host, VentaFragment())
                .commit()
        }
        findViewById<com.google.android.material.bottomnavigation.BottomNavigationView>(R.id.bottom_nav)
            .setOnItemSelectedListener { item ->
                val f = when (item.itemId) {
                    R.id.nav_config -> ConfigFragment()
                    else -> VentaFragment()
                }
                supportFragmentManager.beginTransaction().replace(R.id.nav_host, f).commit()
                true
            }
    }
}

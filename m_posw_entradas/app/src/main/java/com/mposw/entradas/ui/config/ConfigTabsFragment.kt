package com.mposw.entradas.ui.config

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.mposw.entradas.databinding.FragmentConfigTabsBinding

/** Configuración por pestañas: Estado | Conexión | Impresora | Apariencia. */
class ConfigTabsFragment : Fragment() {
    private var _b: FragmentConfigTabsBinding? = null
    private val b get() = _b!!
    private var tabMediator: TabLayoutMediator? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentConfigTabsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.toolbarConfig.setNavigationOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }
        b.vpConfig.adapter = object : FragmentStateAdapter(this@ConfigTabsFragment) {
            override fun getItemCount(): Int = 4
            override fun createFragment(position: Int): Fragment = when (position) {
                0 -> ConfigEstadoFragment()
                1 -> ConfigConexionFragment()
                2 -> ConfigImpresoraFragment()
                else -> ConfigAparienciaFragment()
            }
        }
        tabMediator = TabLayoutMediator(b.tabConfig, b.vpConfig) { tab, pos ->
            tab.text = when (pos) {
                0 -> "Estado"
                1 -> "Conexión"
                2 -> "Impresora"
                else -> "Apariencia"
            }
        }.also { it.attach() }
    }

    override fun onDestroyView() {
        tabMediator?.detach()
        tabMediator = null
        // Igual que el dash POS: desmontar el pager antes de destruir la vista.
        _b?.let { it.vpConfig.adapter = null }
        super.onDestroyView()
        _b = null
    }
}

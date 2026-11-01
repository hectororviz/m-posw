package com.mposw.entradas.ui.config

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.FragmentConfigTabsBinding
import com.mposw.entradas.ui.config.acreedores.ConfigAcreedoresFragment
import kotlinx.coroutines.launch

/**
 * Configuración por pestañas: Acreedores (solo POS con fiado) |
 * Estado | Conexión | Impresora | Apariencia.
 */
class ConfigTabsFragment : Fragment() {
    private var _b: FragmentConfigTabsBinding? = null
    private val b get() = _b!!
    private var tabMediator: TabLayoutMediator? = null
    private var showAcreedores = false

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentConfigTabsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.toolbarConfig.setNavigationOnClickListener { requireActivity().onBackPressedDispatcher.onBackPressed() }
        bindTabs()
        // La solapa Acreedores solo existe en terminales POS con fiado
        // habilitado. Si el equipo es ENTRADAS (403) o el módulo está
        // apagado, se queda en las 4 tabs de siempre.
        lifecycleScope.launch {
            try {
                val session = SessionManager(requireContext())
                if (!session.isPaired) return@launch
                val s = PosSalesRepo(requireContext(), session).settings()
                if (s.enableFiadoPayment && isAdded) {
                    showAcreedores = true
                    bindTabs()
                }
            } catch (_: Exception) {}
        }
    }

    private fun titleFor(pos: Int): String {
        if (!showAcreedores) return when (pos) {
            0 -> "Estado"
            1 -> "Conexión"
            2 -> "Impresora"
            else -> "Apariencia"
        }
        return when (pos) {
            0 -> "Acreedores"
            1 -> "Estado"
            2 -> "Conexión"
            3 -> "Impresora"
            else -> "Apariencia"
        }
    }

    private fun fragmentFor(pos: Int): Fragment {
        if (!showAcreedores) return when (pos) {
            0 -> ConfigEstadoFragment()
            1 -> ConfigConexionFragment()
            2 -> ConfigImpresoraFragment()
            else -> ConfigAparienciaFragment()
        }
        return when (pos) {
            0 -> ConfigAcreedoresFragment()
            1 -> ConfigEstadoFragment()
            2 -> ConfigConexionFragment()
            3 -> ConfigImpresoraFragment()
            else -> ConfigAparienciaFragment()
        }
    }

    private fun bindTabs() {
        if (_b == null || !isAdded) return
        tabMediator?.detach()
        tabMediator = null
        val count = if (showAcreedores) 5 else 4
        b.vpConfig.adapter = object : FragmentStateAdapter(this@ConfigTabsFragment) {
            override fun getItemCount(): Int = count
            override fun createFragment(position: Int): Fragment = fragmentFor(position)
        }
        tabMediator = TabLayoutMediator(b.tabConfig, b.vpConfig) { tab, pos ->
            tab.text = titleFor(pos)
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

package com.mposw.entradas.ui.config

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatDelegate
import androidx.fragment.app.Fragment
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.databinding.TabConfigAparienciaBinding
import com.mposw.entradas.util.DialogStyle

/** Pestaña Apariencia: tamaño POS + tema + modo prueba. */
class ConfigAparienciaFragment : Fragment() {
    private var _b: TabConfigAparienciaBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = TabConfigAparienciaBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        DialogStyle.centerContentWide(b.root)

        b.swModoPrueba.isChecked = session.modoPrueba
        b.swModoPrueba.setOnCheckedChangeListener { _, checked ->
            session.modoPrueba = checked
        }

        when (session.themeMode) {
            "light" -> b.tgTheme.check(b.btnThemeLight.id)
            "dark" -> b.tgTheme.check(b.btnThemeDark.id)
            else -> b.tgTheme.check(b.btnThemeSystem.id)
        }
        b.tgTheme.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            val mode = when (checkedId) {
                b.btnThemeLight.id -> "light"
                b.btnThemeDark.id -> "dark"
                else -> "system"
            }
            session.themeMode = mode
            AppCompatDelegate.setDefaultNightMode(
                when (mode) {
                    "light" -> AppCompatDelegate.MODE_NIGHT_NO
                    "dark" -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                },
            )
        }

        when (session.textScale) {
            "S" -> b.tgTextScale.check(b.btnScaleS.id)
            "L" -> b.tgTextScale.check(b.btnScaleL.id)
            else -> b.tgTextScale.check(b.btnScaleM.id)
        }
        b.tgTextScale.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            session.textScale = when (checkedId) {
                b.btnScaleS.id -> "S"
                b.btnScaleL.id -> "L"
                else -> "M"
            }
            session.scaleDirty = true
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}

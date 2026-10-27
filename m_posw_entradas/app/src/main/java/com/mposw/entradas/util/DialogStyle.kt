package com.mposw.entradas.util

import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ScrollView
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.Fragment
import com.mposw.entradas.R

/** Ventana de diálogo con el radio del tema (24dp) sobre la superficie. */
object DialogStyle {
    fun round(window: android.view.Window?) {
        window?.setBackgroundDrawableResource(R.drawable.dialog_rounded)
    }

    fun isWide(f: Fragment): Boolean = try {
        f.resources.getBoolean(R.bool.is_wide)
    } catch (_: Exception) {
        false
    }

    /**
     * En tablets topa el ancho del diálogo a 560dp centrado; en teléfono
     * no toca nada. [fullHeight] para bottom sheets (alto MATCH_PARENT).
     */
    fun capWidth(f: DialogFragment, maxDp: Int = 560, fullHeight: Boolean = false) {
        if (!isWide(f)) return
        try {
            val window = f.dialog?.window ?: return
            val dm = f.resources.displayMetrics
            val marginPx = (32 * dm.density).toInt()
            val w = minOf((maxDp * dm.density).toInt(), dm.widthPixels - marginPx)
            if (w <= 0) return
            window.setLayout(
                w,
                if (fullHeight) ViewGroup.LayoutParams.MATCH_PARENT else ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        } catch (_: Exception) {
        }
    }

    /**
     * Centra el contenido de un ScrollView de pantalla completa con tope
     * de ancho en tablets (Entradas, Config). En teléfono no toca nada.
     */
    fun centerContentWide(scroll: ScrollView, maxDp: Int = 560) {
        try {
            if (!scroll.resources.getBoolean(R.bool.is_wide)) return
            val inner = scroll.getChildAt(0) ?: return
            val dm = scroll.resources.displayMetrics
            val marginPx = (32 * dm.density).toInt()
            val w = minOf((maxDp * dm.density).toInt(), dm.widthPixels - marginPx)
            if (w <= 0) return
            inner.layoutParams = FrameLayout.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.CENTER_HORIZONTAL
            }
        } catch (_: Exception) {
        }
    }
}

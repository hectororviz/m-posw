package com.mposw.entradas.util

import android.view.Window
import com.mposw.entradas.R

/** Ventana de diálogo con el radio del tema (24dp) sobre la superficie. */
object DialogStyle {
    fun round(window: Window?) {
        window?.setBackgroundDrawableResource(R.drawable.dialog_rounded)
    }
}

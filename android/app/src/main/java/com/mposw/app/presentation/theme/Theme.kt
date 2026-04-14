package com.mposw.app.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

val Amber500 = Color(0xFFf59e0b)
val Amber600 = Color(0xFFd97706)
val Slate50 = Color(0xFFf8fafc)
val Slate100 = Color(0xFFf1f5f9)
val Slate200 = Color(0xFFe2e8f0)
val Slate400 = Color(0xFF94a3b8)
val Slate500 = Color(0xFF64748b)
val Slate700 = Color(0xFF334155)
val Slate900 = Color(0xFF0f172a)
val Red500 = Color(0xFFef4444)
val Red700 = Color(0xFFb91c1c)
val Green500 = Color(0xFF22c55e)
val Green700 = Color(0xFF15803d)
val Blue400 = Color(0xFF60a5fa)
val Blue500 = Color(0xFF3b82f6)
val Sky400 = Color(0xFF38bdf8)

private val LightColors = lightColorScheme(
    primary = Amber500,
    onPrimary = Color.White,
    primaryContainer = Amber500,
    onPrimaryContainer = Color.White,
    secondary = Slate700,
    onSecondary = Color.White,
    secondaryContainer = Slate100,
    onSecondaryContainer = Slate900,
    tertiary = Blue500,
    onTertiary = Color.White,
    background = Slate50,
    onBackground = Slate900,
    surface = Color.White,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate500,
    error = Red700,
    onError = Color.White,
    outline = Slate200
)

private val DarkColors = darkColorScheme(
    primary = Amber500,
    onPrimary = Color.White,
    primaryContainer = Amber600,
    onPrimaryContainer = Color.White,
    secondary = Slate200,
    onSecondary = Slate900,
    secondaryContainer = Slate700,
    onSecondaryContainer = Color.White,
    tertiary = Blue400,
    onTertiary = Slate900,
    background = Slate900,
    onBackground = Slate50,
    surface = Slate700,
    onSurface = Slate50,
    surfaceVariant = Slate700,
    onSurfaceVariant = Slate400,
    error = Red500,
    onError = Color.White,
    outline = Slate500
)

data class MPOSwColors(
    val accent: Color = Amber500,
    val background: Color = Slate50,
    val surface: Color = Color.White,
    val error: Color = Red700,
    val success: Color = Green700,
    val cardBackground: Color = Color.White,
    val border: Color = Slate200,
    val textPrimary: Color = Slate900,
    val textSecondary: Color = Slate500,
    val textDisabled: Color = Slate400
)

val LocalMPOSwColors = staticCompositionLocalOf { MPOSwColors() }

@Composable
fun MPOSwTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    accentColor: Color = Amber500,
    content: @Composable () -> Unit
) {
    val colors = MPOSwColors(accent = accentColor)
    val colorScheme = if (darkTheme) DarkColors else LightColors

    CompositionLocalProvider(LocalMPOSwColors provides colors) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}

object MPOSwTheme {
    @Composable
    @ReadOnlyComposable
    fun colors(): MPOSwColors = LocalMPOSwColors.current
}
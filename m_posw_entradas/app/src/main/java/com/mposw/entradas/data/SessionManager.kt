package com.mposw.entradas.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionManager(context: Context) {
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "entradas_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var baseUrl: String
        get() = prefs.getString("baseUrl", "")?.trimEnd('/')?.plus("/") ?: ""
        set(v) = prefs.edit().putString("baseUrl", v.trim().trimEnd('/') + "/").apply()

    var token: String
        get() = prefs.getString("token", "")?.trim() ?: ""
        set(v) = prefs.edit().putString("token", v.trim()).apply()

    val isPaired: Boolean get() = baseUrl.isNotBlank() && token.startsWith("ent_")

    var templateVersion: Int
        get() = prefs.getInt("templateVersion", -1)
        set(v) = prefs.edit().putInt("templateVersion", v).apply()

    var logoVersion: Int
        get() = prefs.getInt("logoVersion", -1)
        set(v) = prefs.edit().putInt("logoVersion", v).apply()

    var templateJson: String
        get() = prefs.getString("templateJson", "") ?: ""
        set(v) = prefs.edit().putString("templateJson", v).apply()

    var escudoBase64: String
        get() = prefs.getString("escudoBase64", "") ?: ""
        set(v) = prefs.edit().putString("escudoBase64", v).apply()

    var brandColor: String
        get() = prefs.getString("brandColor", "") ?: ""
        set(v) = prefs.edit().putString("brandColor", v.trim()).apply()

    var clubName: String
        get() = prefs.getString("clubName", "") ?: ""
        set(v) = prefs.edit().putString("clubName", v.trim()).apply()

    var logoPath: String
        get() = prefs.getString("logoPath", "") ?: ""
        set(v) = prefs.edit().putString("logoPath", v.trim()).apply()

    var logoCacheVersion: Int
        get() = prefs.getInt("logoCacheVersion", -1)
        set(v) = prefs.edit().putInt("logoCacheVersion", v).apply()

    /** Origen https sin el /api final, para resolver uploads relativos. */
    fun apiRoot(): String = baseUrl.removeSuffix("api/")

    /** URL absoluta del logo del sistema, o null si no hay. */
    fun logoAbsoluteUrl(): String? {
        val p = logoPath.trim()
        if (p.isBlank()) return null
        if (p.startsWith("http")) return p
        return apiRoot() + p.trimStart('/')
    }

    fun clearToken() {
        prefs.edit().remove("token").apply()
    }

    companion object {
        fun normalizeBaseUrl(raw: String): String {
            var u = raw.trim().trimEnd('/')
            if (!u.endsWith("/api")) u += "/api"
            return "$u/"
        }
    }
}

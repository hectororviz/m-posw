package com.mposw.entradas.data

/** Modo de terminal definido por el servidor (GET entradas/devices/me). */
enum class DeviceMode {
    ENTRADAS,
    POS,
    UNKNOWN,
    ;

    companion object {
        fun of(raw: String?): DeviceMode =
            when (raw?.trim()?.uppercase()) {
                "POS" -> POS
                "ENTRADAS" -> ENTRADAS
                else -> UNKNOWN
            }
    }
}

sealed interface ModeResult {
    data class Ok(val mode: DeviceMode) : ModeResult

    /** Sin conexión: se usa el último modo conocido (puede ser UNKNOWN). */
    data class Offline(val lastKnown: DeviceMode) : ModeResult

    /** 401: token revocado o inválido, hay que re-vincular. */
    data object Revoked : ModeResult
}

/**
 * Resuelve el modo consultando al servidor en cada arranque y al volver
 * a primer plano. Nunca confía en el cliente ni en el QR.
 */
class ModeResolver(private val session: SessionManager) {
    private val api: ApiService get() = ApiClient.service(session)

    suspend fun resolve(): ModeResult {
        if (!session.isPaired) return ModeResult.Offline(DeviceMode.UNKNOWN)
        return try {
            val me = api.me()
            val mode = DeviceMode.of(me.tipo).let { if (it == DeviceMode.UNKNOWN) DeviceMode.ENTRADAS else it }
            session.deviceMode = mode.name
            ModeResult.Ok(mode)
        } catch (e: Exception) {
            val msg = e.message ?: ""
            if (msg.contains("401") || msg.contains("DEVICE_REVOKED")) {
                session.clearToken()
                ModeResult.Revoked
            } else {
                ModeResult.Offline(DeviceMode.of(session.deviceMode))
            }
        }
    }
}

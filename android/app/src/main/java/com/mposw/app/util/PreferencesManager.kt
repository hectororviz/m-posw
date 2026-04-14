package com.mposw.app.util

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "mposw_prefs")

class PreferencesManager(private val context: Context) {

    companion object {
        private val AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val API_BASE_URL = stringPreferencesKey("api_base_url")
        private val USER_ID = stringPreferencesKey("user_id")
        private val USER_NAME = stringPreferencesKey("user_name")
        private val USER_ROLE = stringPreferencesKey("user_role")
        private val BLUETOOTH_PRINTER_ADDRESS = stringPreferencesKey("bluetooth_printer_address")
        private val BLUETOOTH_PRINTER_NAME = stringPreferencesKey("bluetooth_printer_name")

        const val DEFAULT_API_URL = "https://pos.csdsoler.com.ar/api/"
    }

    val authToken: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[AUTH_TOKEN]
        }
    }.getOrNull()

    val apiBaseUrl: String get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[API_BASE_URL] ?: DEFAULT_API_URL
        }
    }.getOrDefault(DEFAULT_API_URL)

    val currentUserId: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[USER_ID]
        }
    }.getOrNull()

    val currentUserName: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[USER_NAME]
        }
    }.getOrNull()

    val currentUserRole: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[USER_ROLE]
        }
    }.getOrNull()

    val bluetoothPrinterAddress: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[BLUETOOTH_PRINTER_ADDRESS]
        }
    }.getOrNull()

    val bluetoothPrinterName: String? get() = runCatching {
        kotlinx.coroutines.runBlocking {
            context.dataStore.data.first()[BLUETOOTH_PRINTER_NAME]
        }
    }.getOrNull()

    val isAdmin: Boolean get() = currentUserRole == "ADMIN"

    val authTokenFlow: Flow<String?> = context.dataStore.data.map { it[AUTH_TOKEN] }

    val apiBaseUrlFlow: Flow<String?> = context.dataStore.data.map { it[API_BASE_URL] }

    suspend fun saveAuthData(token: String, userId: String, userName: String, role: String) {
        context.dataStore.edit { prefs ->
            prefs[AUTH_TOKEN] = token
            prefs[USER_ID] = userId
            prefs[USER_NAME] = userName
            prefs[USER_ROLE] = role
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(AUTH_TOKEN)
            prefs.remove(USER_ID)
            prefs.remove(USER_NAME)
            prefs.remove(USER_ROLE)
        }
    }

    suspend fun saveApiBaseUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[API_BASE_URL] = url
        }
    }

    suspend fun saveBluetoothPrinter(address: String, name: String) {
        context.dataStore.edit { prefs ->
            prefs[BLUETOOTH_PRINTER_ADDRESS] = address
            prefs[BLUETOOTH_PRINTER_NAME] = name
        }
    }

    suspend fun clearBluetoothPrinter() {
        context.dataStore.edit { prefs ->
            prefs.remove(BLUETOOTH_PRINTER_ADDRESS)
            prefs.remove(BLUETOOTH_PRINTER_NAME)
        }
    }
}
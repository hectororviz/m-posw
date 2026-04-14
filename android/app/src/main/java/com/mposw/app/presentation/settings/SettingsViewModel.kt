package com.mposw.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mposw.app.data.model.Setting
import com.mposw.app.data.repository.Result
import com.mposw.app.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val apiBaseUrl: String = "",
    val settings: Setting? = null,
    val enableTicketPrinting: Boolean = true,
    val savedPrinter: PrinterInfo? = null,
    val availablePrinters: List<PrinterInfo> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

data class PrinterInfo(
    val address: String,
    val name: String
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            _uiState.update { it.copy(apiBaseUrl = settingsRepository.getApiBaseUrl()) }

            val (address, name) = settingsRepository.getBluetoothPrinter()
            _uiState.update {
                it.copy(
                    savedPrinter = if (address != null) PrinterInfo(address, name ?: address) else null
                )
            }

            when (val result = settingsRepository.getSettings()) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            settings = result.data,
                            enableTicketPrinting = result.data.enableTicketPrinting != false,
                            isLoading = false
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun updateApiBaseUrl(url: String) {
        _uiState.update { it.copy(apiBaseUrl = url) }
    }

    fun saveApiBaseUrl() {
        viewModelScope.launch {
            settingsRepository.setApiBaseUrl(_uiState.value.apiBaseUrl)
        }
    }

    fun toggleTicketPrinting() {
        val newValue = !_uiState.value.enableTicketPrinting
        _uiState.update { it.copy(enableTicketPrinting = newValue) }

        viewModelScope.launch {
            val currentSettings = _uiState.value.settings ?: Setting()
            settingsRepository.updateSettings(currentSettings.copy(enableTicketPrinting = newValue))
        }
    }

    fun scanPrinters() {
        // TODO: Implement Bluetooth scanning
    }

    fun selectPrinter(printer: PrinterInfo) {
        viewModelScope.launch {
            settingsRepository.saveBluetoothPrinter(printer.address, printer.name)
            _uiState.update { it.copy(savedPrinter = printer) }
        }
    }

    fun clearPrinter() {
        viewModelScope.launch {
            settingsRepository.clearBluetoothPrinter()
            _uiState.update { it.copy(savedPrinter = null) }
        }
    }
}
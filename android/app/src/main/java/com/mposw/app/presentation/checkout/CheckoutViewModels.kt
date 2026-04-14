package com.mposw.app.presentation.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mposw.app.data.model.SaleItemInput
import com.mposw.app.data.repository.Result
import com.mposw.app.data.repository.SaleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CheckoutUiState(
    val total: Double = 0.0,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val saleRepository: SaleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CheckoutUiState())
    val uiState: StateFlow<CheckoutUiState> = _uiState.asStateFlow()

    fun setCartItems(items: List<Pair<String, Int>>, total: Double) {
        _uiState.update { it.copy(total = total) }
    }

    fun loadTotals() {}

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class CashPaymentUiState(
    val total: Double = 0.0,
    val cashReceived: String = "",
    val saleId: String? = null,
    val isProcessing: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class CashPaymentViewModel @Inject constructor(
    private val saleRepository: SaleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CashPaymentUiState())
    val uiState: StateFlow<CashPaymentUiState> = _uiState.asStateFlow()

    private var cartItems: List<Pair<String, Int>> = emptyList()

    fun setCartItems(items: List<Pair<String, Int>>) {
        cartItems = items
    }

    fun setTotal(total: Double) {
        _uiState.update { it.copy(total = total) }
    }

    fun updateCashReceived(value: String) {
        _uiState.update { it.copy(cashReceived = value.filter { c -> c.isDigit() || c == '.' }) }
    }

    fun setCashReceived(amount: Double) {
        _uiState.update { it.copy(cashReceived = amount.toInt().toString()) }
    }

    fun processPayment() {
        val state = _uiState.value
        val items = cartItems.map { SaleItemInput(it.first, it.second) }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true) }
            when (val result = saleRepository.createSale(
                items = items,
                paymentMethod = "CASH",
                cashReceived = state.cashReceived.toDoubleOrNull()
            )) {
                is Result.Success -> {
                    saleRepository.completeSale(result.data.id)
                    _uiState.update { it.copy(isProcessing = false, saleId = result.data.id) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isProcessing = false, error = result.message) }
                }
            }
        }
    }
}

data class QrPaymentUiState(
    val status: String = "PENDING",
    val statusMessage: String? = null,
    val timeLeft: Int = 120
)

@HiltViewModel
class QrPaymentViewModel @Inject constructor(
    private val saleRepository: SaleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(QrPaymentUiState())
    val uiState: StateFlow<QrPaymentUiState> = _uiState.asStateFlow()

    private var saleId: String? = null
    private var pollingJob: kotlinx.coroutines.Job? = null
    private var timerJob: kotlinx.coroutines.Job? = null

    fun startPolling(id: String) {
        saleId = id
        startTimer()
        startPolling()
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            for (i in 120 downTo 0) {
                _uiState.update { it.copy(timeLeft = i) }
                kotlinx.coroutines.delay(1000)
            }
        }
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                saleId?.let { id ->
                    when (val result = saleRepository.getPaymentStatus(id)) {
                        is Result.Success -> {
                            val status = result.data.status
                            _uiState.update {
                                it.copy(
                                    status = status,
                                    statusMessage = result.data.mpStatusDetail
                                )
                            }
                            if (status !in listOf("PENDING", "IN_PROCESS", "WAITING_PAYMENT", "NONE")) {
                                stopPolling()
                                return@launch
                            }
                        }
                        is Result.Error -> {}
                    }
                }
                kotlinx.coroutines.delay(2000)
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        timerJob?.cancel()
    }
}
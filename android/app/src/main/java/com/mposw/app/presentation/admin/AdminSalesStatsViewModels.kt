package com.mposw.app.presentation.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mposw.app.data.repository.Result
import com.mposw.app.data.repository.SaleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AdminSalesUiState(
    val sales: List<com.mposw.app.data.model.Sale> = emptyList(),
    val startDate: String = "",
    val endDate: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class AdminSalesViewModel @Inject constructor(
    private val saleRepository: SaleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminSalesUiState())
    val uiState: StateFlow<AdminSalesUiState> = _uiState.asStateFlow()

    init {
        loadSales()
    }

    fun updateStartDate(date: String) {
        _uiState.update { it.copy(startDate = date) }
    }

    fun updateEndDate(date: String) {
        _uiState.update { it.copy(endDate = date) }
    }

    fun loadSales() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = saleRepository.getSales(
                _uiState.value.startDate.takeIf { it.isNotBlank() },
                _uiState.value.endDate.takeIf { it.isNotBlank() }
            )) {
                is Result.Success -> {
                    _uiState.update { it.copy(sales = result.data, isLoading = false) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message, isLoading = false) }
                }
            }
        }
    }
}

data class AdminStatsUiState(
    val startDate: String = "",
    val endDate: String = "",
    val totalSales: Int = 0,
    val totalAmount: Double = 0.0,
    val cashAmount: Double = 0.0,
    val mpAmount: Double = 0.0,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class AdminStatsViewModel @Inject constructor(
    private val saleRepository: SaleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminStatsUiState())
    val uiState: StateFlow<AdminStatsUiState> = _uiState.asStateFlow()

    init {
        loadStats()
    }

    fun updateStartDate(date: String) {
        _uiState.update { it.copy(startDate = date) }
    }

    fun updateEndDate(date: String) {
        _uiState.update { it.copy(endDate = date) }
    }

    fun loadStats() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = saleRepository.getSales(
                _uiState.value.startDate.takeIf { it.isNotBlank() },
                _uiState.value.endDate.takeIf { it.isNotBlank() }
            )) {
                is Result.Success -> {
                    val sales = result.data.filter { it.status == "APPROVED" }
                    val totalAmount = sales.sumOf { it.total }
                    val cashAmount = sales.filter { it.paymentMethod == "CASH" }.sumOf { it.total }
                    val mpAmount = sales.filter { it.paymentMethod == "MP_QR" }.sumOf { it.total }
                    _uiState.update {
                        it.copy(
                            totalSales = sales.size,
                            totalAmount = totalAmount,
                            cashAmount = cashAmount,
                            mpAmount = mpAmount,
                            isLoading = false
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message, isLoading = false) }
                }
            }
        }
    }
}
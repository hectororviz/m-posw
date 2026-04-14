package com.mposw.app.presentation.sales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mposw.app.data.model.Category
import com.mposw.app.data.model.Product
import com.mposw.app.data.model.Setting
import com.mposw.app.data.repository.*
import com.mposw.app.domain.model.CartManager
import com.mposw.app.domain.model.CartState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SalesUiState(
    val categories: List<Category> = emptyList(),
    val products: List<Product> = emptyList(),
    val selectedCategoryId: String = "",
    val selectedCategory: Category? = null,
    val userName: String? = null,
    val isAdmin: Boolean = false,
    val settings: Setting? = null,
    val isLoadingProducts: Boolean = false,
    val isLoadingCategories: Boolean = false,
    val isLoadingSettings: Boolean = false
)

@HiltViewModel
class SalesViewModel @Inject constructor(
    private val categoryRepository: CategoryRepository,
    private val productRepository: ProductRepository,
    private val settingsRepository: SettingsRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SalesUiState())
    val uiState: StateFlow<SalesUiState> = _uiState.asStateFlow()

    private val cartManager = CartManager()
    val cartState: StateFlow<CartState> = cartManager.state

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingCategories = true) }
            when (val result = categoryRepository.loadCategories()) {
                is Result.Success -> {
                    val categories = result.data.filter { it.active }
                    val firstCat = categories.firstOrNull()
                    _uiState.update {
                        it.copy(
                            categories = categories,
                            selectedCategoryId = firstCat?.id ?: "",
                            selectedCategory = firstCat,
                            isLoadingCategories = false
                        )
                    }
                    firstCat?.let { loadProducts(it.id) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoadingCategories = false) }
                }
            }
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingSettings = true) }
            when (val result = settingsRepository.getSettings()) {
                is Result.Success -> {
                    _uiState.update { it.copy(settings = result.data, isLoadingSettings = false) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoadingSettings = false) }
                }
            }
        }

        _uiState.update {
            it.copy(
                userName = authRepository.currentUserName(),
                isAdmin = authRepository.isAdmin()
            )
        }
    }

    fun selectCategory(categoryId: String) {
        val category = _uiState.value.categories.find { it.id == categoryId }
        _uiState.update { it.copy(selectedCategoryId = categoryId, selectedCategory = category) }
        loadProducts(categoryId)
    }

    private fun loadProducts(categoryId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingProducts = true) }
            when (val result = productRepository.getProductsByCategory(categoryId)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            products = result.data.filter { it.active },
                            isLoadingProducts = false
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoadingProducts = false) }
                }
            }
        }
    }

    fun addToCart(product: Product) {
        cartManager.addItem(product)
    }

    fun updateCartQuantity(productId: String, quantity: Int) {
        cartManager.updateQuantity(productId, quantity)
    }

    fun removeFromCart(productId: String) {
        cartManager.removeItem(productId)
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }

    fun getCartItems(): List<Pair<String, Int>> {
        return cartManager.state.value.items.map { Pair(it.product.id, it.quantity) }
    }

    fun getCartTotal(): Double {
        return cartManager.state.value.total
    }

    fun clearCart() {
        cartManager.clear()
    }
}
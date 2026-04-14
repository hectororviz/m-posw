package com.mposw.app.domain.model

import com.mposw.app.data.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class CartItem(
    val product: Product,
    val quantity: Int = 1
) {
    val subtotal: Double get() = product.price * quantity
}

data class CartState(
    val items: List<CartItem> = emptyList(),
    val isCollapsed: Boolean = false
) {
    val total: Double get() = items.sumOf { it.subtotal }
    val isEmpty: Boolean get() = items.isEmpty()
    val itemCount: Int get() = items.sumOf { it.quantity }
}

class CartManager {
    private val _state = MutableStateFlow(CartState())
    val state: StateFlow<CartState> = _state.asStateFlow()

    fun addItem(product: Product, quantity: Int = 1) {
        _state.update { currentState: CartState ->
            val existingItem = currentState.items.find { item: CartItem -> item.product.id == product.id }
            val newItems = if (existingItem != null) {
                currentState.items.map { item: CartItem ->
                    if (item.product.id == product.id) item.copy(quantity = item.quantity + quantity) else item
                }
            } else {
                currentState.items + CartItem(product = product, quantity = quantity)
            }
            currentState.copy(items = newItems)
        }
    }

    fun updateQuantity(productId: String, quantity: Int) {
        if (quantity <= 0) { removeItem(productId); return }
        _state.update { currentState: CartState ->
            currentState.copy(items = currentState.items.map { item: CartItem ->
                if (item.product.id == productId) item.copy(quantity = quantity) else item
            })
        }
    }

    fun removeItem(productId: String) {
        _state.update { currentState: CartState ->
            currentState.copy(items = currentState.items.filter { item: CartItem -> item.product.id != productId })
        }
    }

    fun clear() {
        _state.value = CartState()
    }

    fun toggleCollapsed() {
        _state.update { it.copy(isCollapsed = !it.isCollapsed) }
    }
}
package com.mposw.app.data.repository

import com.mposw.app.data.api.ApiService
import com.mposw.app.data.model.*
import com.mposw.app.util.PreferencesManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val prefs: PreferencesManager
) {
    suspend fun login(name: String?, email: String?, pin: String): Result<AuthResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.login(LoginRequest(name = name, email = email, pin = pin))
            if (response.isSuccessful) {
                val authResponse = response.body()!!
                prefs.saveAuthData(
                    token = authResponse.accessToken,
                    userId = authResponse.user.id,
                    userName = authResponse.user.name,
                    role = authResponse.user.role
                )
                Result.Success(authResponse)
            } else {
                val errorBody = response.errorBody()?.string()
                Result.Error(parseErrorMessage(errorBody, response.code()))
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    private fun parseErrorMessage(body: String?, statusCode: Int = 401): String {
        if (body.isNullOrBlank()) {
            return when (statusCode) {
                401 -> "Usuario o contraseña incorrectos"
                403 -> "Acceso denegado"
                404 -> "Recurso no encontrado"
                500 -> "Error del servidor"
                else -> "Error de conexión ($statusCode)"
            }
        }
        return try {
            val regex = """"message"\s*:\s*"([^"]+)"""".toRegex()
            val match = regex.find(body)
            match?.groupValues?.get(1) ?: body
        } catch (e: Exception) {
            body
        }
    }

    suspend fun getUsers(): Result<List<User>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getLoginUsers()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    Result.Success(body)
                } else {
                    Result.Error("No se recibieron datos del servidor")
                }
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val message = parseErrorMessage(errorBody, response.code())
                Result.Error(message)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun logout() {
        prefs.clearAuth()
    }

    fun isAdmin(): Boolean = prefs.isAdmin

    fun currentUserName(): String? = prefs.currentUserName
}

@Singleton
class CategoryRepository @Inject constructor(
    private val api: ApiService
) {
    private val _categories = MutableStateFlow<List<Category>>(emptyList())
    val categories: StateFlow<List<Category>> = _categories

    suspend fun loadCategories(): Result<List<Category>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getCategories()
            if (response.isSuccessful) {
                _categories.value = response.body()!!
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al cargar categorías")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun createCategory(category: Category): Result<Category> = withContext(Dispatchers.IO) {
        try {
            val response = api.createCategory(category)
            if (response.isSuccessful) {
                loadCategories()
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al crear categoría")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun updateCategory(id: String, category: Category): Result<Category> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateCategory(id, category)
            if (response.isSuccessful) {
                loadCategories()
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al actualizar categoría")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun deleteCategory(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.deleteCategory(id)
            if (response.isSuccessful) {
                loadCategories()
                Result.Success(Unit)
            } else {
                Result.Error("Error al eliminar categoría")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }
}

@Singleton
class ProductRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun getProducts(): Result<List<Product>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getProducts()
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al cargar productos")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun getProductsByCategory(categoryId: String): Result<List<Product>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getProductsByCategory(categoryId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al cargar productos")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun createProduct(product: Product): Result<Product> = withContext(Dispatchers.IO) {
        try {
            val response = api.createProduct(product)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al crear producto")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun updateProduct(id: String, product: Product): Result<Product> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateProduct(id, product)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al actualizar producto")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun deleteProduct(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.deleteProduct(id)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("Error al eliminar producto")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }
}

@Singleton
class SaleRepository @Inject constructor(
    private val api: ApiService
) {
    suspend fun createSale(items: List<SaleItemInput>, paymentMethod: String, cashReceived: Double? = null): Result<Sale> = withContext(Dispatchers.IO) {
        try {
            val response = api.createSale(CreateSaleRequest(items, paymentMethod, cashReceived))
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al crear venta")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun getSale(saleId: String): Result<Sale> = withContext(Dispatchers.IO) {
        try {
            val response = api.getSale(saleId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al obtener venta")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun completeSale(saleId: String): Result<Sale> = withContext(Dispatchers.IO) {
        try {
            val response = api.completeSale(saleId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al completar venta")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun getPaymentStatus(saleId: String): Result<PaymentStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.getPaymentStatus(saleId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al verificar pago")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun getSales(startDate: String? = null, endDate: String? = null): Result<List<Sale>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getSales(startDate, endDate)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al cargar ventas")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun markTicketPrinted(saleId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.markTicketPrinted(saleId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("Error al marcar ticket")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }
}

@Singleton
class SettingsRepository @Inject constructor(
    private val api: ApiService,
    private val prefs: PreferencesManager
) {
    suspend fun getSettings(): Result<Setting> = withContext(Dispatchers.IO) {
        try {
            val response = api.getSettings()
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al cargar configuración")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    suspend fun updateSettings(settings: Setting): Result<Setting> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateSettings(settings)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Error al guardar configuración")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Error de conexión")
        }
    }

    fun getBluetoothPrinter(): Pair<String?, String?> = Pair(prefs.bluetoothPrinterAddress, prefs.bluetoothPrinterName)

    suspend fun saveBluetoothPrinter(address: String, name: String) {
        prefs.saveBluetoothPrinter(address, name)
    }

    suspend fun clearBluetoothPrinter() {
        prefs.clearBluetoothPrinter()
    }

    fun getApiBaseUrl(): String = prefs.apiBaseUrl

    suspend fun setApiBaseUrl(url: String) {
        prefs.saveApiBaseUrl(url)
    }
}
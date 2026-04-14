package com.mposw.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mposw.app.data.model.User
import com.mposw.app.data.repository.AuthRepository
import com.mposw.app.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val users: List<User> = emptyList(),
    val selectedUserId: String = "",
    val pin: String = "",
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val error: String? = null,
    val usersLoading: Boolean = true,
    val usersError: String? = null,
    val showUsersError: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        loadUsers()
    }

    private fun loadUsers() {
        viewModelScope.launch {
            _uiState.update { it.copy(usersLoading = true) }
            when (val result = authRepository.getUsers()) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            users = result.data,
                            usersLoading = false,
                            showUsersError = false
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(
                            usersLoading = false,
                            usersError = result.message,
                            showUsersError = true
                        )
                    }
                }
            }
        }
    }

    fun selectUser(user: User) {
        _uiState.update {
            it.copy(
                selectedUserId = user.id,
                pin = "",
                error = null
            )
        }
    }

    fun updatePin(value: String) {
        _uiState.update { it.copy(pin = value.filter { c -> c.isDigit() }.take(6)) }
    }

    fun appendDigit(digit: String) {
        _uiState.update {
            it.copy(pin = (it.pin + digit).take(6))
        }
    }

    fun clearPin() {
        _uiState.update { it.copy(pin = "") }
    }

    fun backspacePin() {
        _uiState.update { it.copy(pin = it.pin.dropLast(1)) }
    }

    fun login() {
        val currentState = _uiState.value
        if (currentState.selectedUserId.isEmpty() || currentState.pin.length != 6) {
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val selectedUser = currentState.users.find { it.id == currentState.selectedUserId }
            val result = authRepository.login(
                name = selectedUser?.name,
                email = selectedUser?.email,
                pin = currentState.pin
            )

            when (result) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = result.message) }
                }
            }
        }
    }

    fun dismissUsersError() {
        _uiState.update { it.copy(showUsersError = false) }
    }
}
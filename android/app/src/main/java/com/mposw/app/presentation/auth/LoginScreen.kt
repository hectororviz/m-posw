package com.mposw.app.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.presentation.theme.MPOSwTheme
import com.mposw.app.presentation.components.LoadingOverlay
import com.mposw.app.presentation.components.ErrorDialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var expanded by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoggedIn) {
        if (uiState.isLoggedIn) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MPOSwTheme.colors().background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Iniciar sesion",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MPOSwTheme.colors().textPrimary
            )

            if (uiState.users.isNotEmpty()) {
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it }
                ) {
                    OutlinedTextField(
                        value = uiState.users.find { it.id == uiState.selectedUserId }?.name ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Usuario") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MPOSwTheme.colors().textPrimary,
                            unfocusedTextColor = MPOSwTheme.colors().textPrimary
                        ),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        uiState.users.filter { it.active != false }.forEach { user ->
                            DropdownMenuItem(
                                text = { Text(user.name, color = MPOSwTheme.colors().textPrimary) },
                                onClick = { viewModel.selectUser(user); expanded = false }
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = uiState.pin,
                onValueChange = { viewModel.updatePin(it) },
                label = { Text("PIN") },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MPOSwTheme.colors().textPrimary,
                    unfocusedTextColor = MPOSwTheme.colors().textPrimary
                ),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            PinKeypad(
                onDigitClick = { digit ->
                    viewModel.appendDigit(digit)
                },
                onClear = { viewModel.clearPin() },
                onBackspace = { viewModel.backspacePin() }
            )

            uiState.error?.let {
                Text(text = it, color = MPOSwTheme.colors().error, fontWeight = FontWeight.SemiBold)
            }

            Button(
                onClick = { viewModel.login() },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp),
                enabled = uiState.pin.length == 6 && uiState.selectedUserId.isNotEmpty() && !uiState.isLoading
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                } else {
                    Text("Entrar", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    if (uiState.isLoading) LoadingOverlay()
    if (uiState.showUsersError) {
        ErrorDialog(
            message = uiState.usersError ?: "Error al cargar usuarios",
            onDismiss = { viewModel.dismissUsersError() }
        )
    }
}

@Composable
fun PinKeypad(
    onDigitClick: (String) -> Unit,
    onClear: () -> Unit,
    onBackspace: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9")).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { digit ->
                    KeypadButton(text = digit, onClick = { onDigitClick(digit) }, modifier = Modifier.weight(1f))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            KeypadButton(text = "Limpiar", onClick = onClear, modifier = Modifier.weight(1f), isSecondary = true)
            KeypadButton(text = "0", onClick = { onDigitClick("0") }, modifier = Modifier.weight(1f))
            KeypadButton(text = "", onClick = onBackspace, modifier = Modifier.weight(1f), isSecondary = true) {
                Icon(Icons.Default.Backspace, contentDescription = "Borrar")
            }
        }
    }
}

@Composable
fun KeypadButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSecondary: Boolean = false,
    content: @Composable () -> Unit = {}
) {
    Box(
        modifier = modifier.height(64.dp).clip(RoundedCornerShape(12.dp))
            .background(if (isSecondary) MPOSwTheme.colors().textDisabled.copy(alpha = 0.1f) else MPOSwTheme.colors().background)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (text.isNotEmpty()) {
            Text(text, fontSize = 24.sp, fontWeight = FontWeight.Bold,
                color = if (isSecondary) MPOSwTheme.colors().textSecondary else MPOSwTheme.colors().textPrimary)
        } else content()
    }
}
package com.mposw.app.presentation.checkout

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.presentation.theme.MPOSwTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrPaymentScreen(
    saleId: String,
    total: Double,
    onBack: () -> Unit,
    onPaymentSuccess: () -> Unit,
    onPaymentFailed: () -> Unit,
    viewModel: QrPaymentViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(saleId) {
        viewModel.startPolling(saleId)
    }

    LaunchedEffect(uiState.status) {
        when (uiState.status) {
            "APPROVED" -> onPaymentSuccess()
            "REJECTED", "CANCELLED", "EXPIRED" -> onPaymentFailed()
            else -> {}
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            viewModel.stopPolling()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mercado Pago QR", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = {
                        viewModel.stopPolling()
                        onBack()
                    }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MPOSwTheme.colors().accent,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Total",
                style = MaterialTheme.typography.titleMedium,
                color = MPOSwTheme.colors().textSecondary
            )
            Text(
                text = "$${String.format("%.2f", total)}",
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(48.dp))

            when (uiState.status) {
                "PENDING", "IN_PROCESS", "WAITING_PAYMENT", "NONE" -> {
                    CircularProgressIndicator(
                        color = MPOSwTheme.colors().accent,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = "Esperando pago...",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Escaneá el QR con la app de Mercado Pago",
                        color = MPOSwTheme.colors().textSecondary,
                        textAlign = TextAlign.Center
                    )
                }
                "APPROVED" -> {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = MPOSwTheme.colors().success,
                        modifier = Modifier.size(80.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = "Pago aprobado",
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = MPOSwTheme.colors().success
                    )
                }
                "REJECTED", "CANCELLED", "EXPIRED" -> {
                    Icon(
                        Icons.Default.Error,
                        contentDescription = null,
                        tint = MPOSwTheme.colors().error,
                        modifier = Modifier.size(80.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = when (uiState.status) {
                            "REJECTED" -> "Pago rechazado"
                            "CANCELLED" -> "Pago cancelado"
                            else -> "Tiempo agotado"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = MPOSwTheme.colors().error
                    )
                }
            }

            if (uiState.statusMessage != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = uiState.statusMessage!!,
                    color = MPOSwTheme.colors().textSecondary,
                    textAlign = TextAlign.Center
                )
            }

            if (uiState.status in listOf("PENDING", "IN_PROCESS", "WAITING_PAYMENT", "NONE")) {
                Spacer(modifier = Modifier.height(32.dp))
                Text(
                    text = formatTime(uiState.timeLeft),
                    fontWeight = FontWeight.Bold,
                    fontSize = 32.sp
                )
            }
        }
    }
}

private fun formatTime(seconds: Int): String {
    val minutes = seconds / 60
    val remaining = seconds % 60
    return "$minutes:${remaining.toString().padStart(2, '0')}"
}
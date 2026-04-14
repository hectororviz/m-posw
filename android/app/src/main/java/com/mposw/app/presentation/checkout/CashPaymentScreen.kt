package com.mposw.app.presentation.checkout

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.presentation.theme.MPOSwTheme
import com.mposw.app.presentation.components.LoadingOverlay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashPaymentScreen(
    total: Double,
    onBack: () -> Unit,
    onPaymentSuccess: (saleId: String) -> Unit,
    viewModel: CashPaymentViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(total) {
        viewModel.setTotal(total)
    }

    LaunchedEffect(uiState.saleId) {
        uiState.saleId?.let { onPaymentSuccess(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pago en efectivo", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
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
            horizontalAlignment = Alignment.CenterHorizontally
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

            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = uiState.cashReceived,
                onValueChange = { viewModel.updateCashReceived(it) },
                label = { Text("Monto recibido") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                prefix = { Text("$") },
                textStyle = MaterialTheme.typography.headlineMedium.copy(textAlign = TextAlign.End)
            )

            Spacer(modifier = Modifier.height(16.dp))

            CashQuickButtons(
                onClick = { viewModel.setCashReceived(it) },
                currentValue = uiState.cashReceived.toDoubleOrNull() ?: 0.0
            )

            Spacer(modifier = Modifier.height(24.dp))

            val change = (uiState.cashReceived.toDoubleOrNull() ?: 0.0) - total
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (change >= 0) MPOSwTheme.colors().success.copy(alpha = 0.1f) 
                        else MPOSwTheme.colors().error.copy(alpha = 0.1f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Cambio",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "$${String.format("%.2f", maxOf(change, 0.0))}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = if (change >= 0) MPOSwTheme.colors().success else MPOSwTheme.colors().error
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = { viewModel.processPayment() },
                enabled = change >= 0 && !uiState.isProcessing,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MPOSwTheme.colors().success
                )
            ) {
                if (uiState.isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White
                    )
                } else {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Finalizar venta", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }

    if (uiState.isProcessing) {
        LoadingOverlay()
    }
}

@Composable
fun CashQuickButtons(
    onClick: (Double) -> Unit,
    currentValue: Double,
    modifier: Modifier = Modifier
) {
    val quickAmounts = listOf(50.0, 100.0, 200.0, 500.0, 1000.0)

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            quickAmounts.take(3).forEach { amount ->
                QuickButton(
                    amount = amount,
                    isSelected = currentValue == amount,
                    onClick = { onClick(amount) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            quickAmounts.drop(3).forEach { amount ->
                QuickButton(
                    amount = amount,
                    isSelected = currentValue == amount,
                    onClick = { onClick(amount) },
                    modifier = Modifier.weight(1f)
                )
            }
            QuickButton(
                amount = currentValue,
                isSelected = false,
                onClick = {  },
                modifier = Modifier.weight(1f),
                label = "Exact"
            )
        }
    }
}

@Composable
fun QuickButton(
    amount: Double,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null
) {
    Surface(
        modifier = modifier
            .height(48.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = if (isSelected) MPOSwTheme.colors().accent else MPOSwTheme.colors().background
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label ?: "$${amount.toInt()}",
                fontWeight = FontWeight.Bold,
                color = if (isSelected) Color.White else MPOSwTheme.colors().textPrimary
            )
        }
    }
}
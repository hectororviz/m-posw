package com.mposw.app.presentation.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.TextUnitType
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.data.model.Sale
import com.mposw.app.presentation.theme.MPOSwTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminSalesScreen(
    onBack: () -> Unit,
    viewModel: AdminSalesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ventas", fontWeight = FontWeight.Bold) },
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
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = uiState.startDate,
                    onValueChange = { viewModel.updateStartDate(it) },
                    label = { Text("Desde") },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = uiState.endDate,
                    onValueChange = { viewModel.updateEndDate(it) },
                    label = { Text("Hasta") },
                    modifier = Modifier.weight(1f)
                )
                Button(onClick = { viewModel.loadSales() }) {
                    Icon(Icons.Default.Search, contentDescription = null)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.sales) { sale ->
                        SaleListItem(sale = sale)
                    }
                }
            }
        }
    }
}

@Composable
fun SaleListItem(sale: Sale) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Ticket #${sale.id.takeLast(8)}",
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "$${String.format("%.2f", sale.total)}",
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = sale.createdAt,
                color = MPOSwTheme.colors().textSecondary
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = sale.paymentMethod ?: "Efectivo",
                    color = MPOSwTheme.colors().textSecondary
                )
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = when (sale.status) {
                        "APPROVED" -> MPOSwTheme.colors().success.copy(alpha = 0.2f)
                        "REJECTED", "CANCELLED" -> MPOSwTheme.colors().error.copy(alpha = 0.2f)
                        else -> MPOSwTheme.colors().accent.copy(alpha = 0.2f)
                    }
                ) {
                    Text(
                        text = sale.status,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        color = when (sale.status) {
                            "APPROVED" -> MPOSwTheme.colors().success
                            "REJECTED", "CANCELLED" -> MPOSwTheme.colors().error
                            else -> MPOSwTheme.colors().accent
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = TextUnit(12f, TextUnitType.Sp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminStatsScreen(
    onBack: () -> Unit,
    viewModel: AdminStatsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Estadisticas", fontWeight = FontWeight.Bold) },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = uiState.startDate,
                    onValueChange = { viewModel.updateStartDate(it) },
                    label = { Text("Desde") },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = uiState.endDate,
                    onValueChange = { viewModel.updateEndDate(it) },
                    label = { Text("Hasta") },
                    modifier = Modifier.weight(1f)
                )
                Button(onClick = { viewModel.loadStats() }) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                }
            }

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatCard(
                        title = "Ventas",
                        value = uiState.totalSales.toString(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Total",
                        value = "$${String.format("%.2f", uiState.totalAmount)}",
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatCard(
                        title = "Efectivo",
                        value = "$${String.format("%.2f", uiState.cashAmount)}",
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Mercado Pago",
                        value = "$${String.format("%.2f", uiState.mpAmount)}",
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                color = MPOSwTheme.colors().textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                fontWeight = FontWeight.Bold,
                fontSize = TextUnit(24f, TextUnitType.Sp)
            )
        }
    }
}
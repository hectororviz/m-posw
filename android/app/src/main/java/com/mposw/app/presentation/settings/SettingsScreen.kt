package com.mposw.app.presentation.settings

import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.presentation.theme.MPOSwTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Configuración", fontWeight = FontWeight.Bold) },
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
            Text(
                text = "API",
                fontWeight = FontWeight.Bold,
                color = MPOSwTheme.colors().textSecondary
            )

            OutlinedTextField(
                value = uiState.apiBaseUrl,
                onValueChange = { viewModel.updateApiBaseUrl(it) },
                label = { Text("URL del backend") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                singleLine = true
            )

            Button(
                onClick = { viewModel.saveApiBaseUrl() },
                enabled = uiState.apiBaseUrl.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Guardar URL")
            }

            Divider()

            Text(
                text = "Impresora Bluetooth",
                fontWeight = FontWeight.Bold,
                color = MPOSwTheme.colors().textSecondary
            )

            if (uiState.savedPrinter != null) {
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = uiState.savedPrinter!!.name,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = uiState.savedPrinter!!.address,
                                color = MPOSwTheme.colors().textSecondary
                            )
                        }
                        IconButton(onClick = { viewModel.clearPrinter() }) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Eliminar",
                                tint = MPOSwTheme.colors().error
                            )
                        }
                    }
                }
            } else {
                Text(
                    text = "No hay impresora configurada",
                    color = MPOSwTheme.colors().textSecondary
                )
            }

            Button(
                onClick = { viewModel.scanPrinters() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Buscar impresoras")
            }

            if (uiState.availablePrinters.isNotEmpty()) {
                uiState.availablePrinters.forEach { printer ->
                    OutlinedCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        onClick = { viewModel.selectPrinter(printer) }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = printer.name,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = printer.address,
                                    color = MPOSwTheme.colors().textSecondary
                                )
                            }
                            Icon(
                                Icons.Default.Add,
                                contentDescription = "Seleccionar"
                            )
                        }
                    }
                }
            }

            Divider()

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Impresión de tickets",
                    fontWeight = FontWeight.Bold
                )
                Switch(
                    checked = uiState.enableTicketPrinting,
                    onCheckedChange = { viewModel.toggleTicketPrinting() }
                )
            }
        }
    }
}
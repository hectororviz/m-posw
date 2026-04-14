package com.mposw.app.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.rememberNavController
import com.mposw.app.data.repository.AuthRepository
import com.mposw.app.presentation.navigation.MPOSwNavigation
import com.mposw.app.presentation.sales.SalesViewModel
import com.mposw.app.presentation.theme.MPOSwTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val accentColor = Color(0xFFf59e0b)
            
            MPOSwTheme(accentColor = accentColor) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    val salesViewModel: SalesViewModel = hiltViewModel()
                    val cartState by salesViewModel.cartState.collectAsState()

                    var onLogoutComplete by remember { mutableStateOf(false) }

                    LaunchedEffect(onLogoutComplete) {
                        if (onLogoutComplete) {
                            navController.navigate("login") {
                                popUpTo(0) { inclusive = true }
                            }
                            onLogoutComplete = false
                        }
                    }

                    MPOSwNavigation(
                        navController = navController,
                        total = cartState.total,
                        onLogout = {
                            CoroutineScope(Dispatchers.IO).launch {
                                authRepository.logout()
                            }
                            onLogoutComplete = true
                        },
                        onPaymentSuccess = {
                            salesViewModel.clearCart()
                        }
                    )
                }
            }
        }
    }
}
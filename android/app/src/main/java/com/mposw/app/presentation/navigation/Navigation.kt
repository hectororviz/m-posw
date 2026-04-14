package com.mposw.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.mposw.app.presentation.auth.LoginScreen
import com.mposw.app.presentation.checkout.CashPaymentScreen
import com.mposw.app.presentation.checkout.CheckoutScreen
import com.mposw.app.presentation.checkout.QrPaymentScreen
import com.mposw.app.presentation.sales.SalesScreen
import com.mposw.app.presentation.settings.SettingsScreen

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Sales : Screen("sales")
    object Checkout : Screen("checkout")
    object CashPayment : Screen("checkout/cash") {
        fun createRoute() = "checkout/cash"
    }
    object QrPayment : Screen("checkout/qr/{saleId}") {
        fun createRoute(saleId: String) = "checkout/qr/$saleId"
    }
    object Settings : Screen("settings")
}

@Composable
fun MPOSwNavigation(
    navController: NavHostController,
    total: Double,
    onLogout: () -> Unit,
    onPaymentSuccess: () -> Unit
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Sales.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Sales.route) {
            SalesScreen(
                onCheckoutClick = {
                    navController.navigate(Screen.Checkout.route)
                }
            )
        }

        composable(Screen.Checkout.route) {
            CheckoutScreen(
                onBack = { navController.popBackStack() },
                onPaymentCash = {
                    navController.navigate(Screen.CashPayment.createRoute())
                },
                onPaymentQr = {
                    // Navigate to QR payment after creating sale
                    navController.navigate("checkout/qr/pending")
                }
            )
        }

        composable(Screen.CashPayment.route) {
            CashPaymentScreen(
                total = total,
                onBack = { navController.popBackStack() },
                onPaymentSuccess = { saleId ->
                    onPaymentSuccess()
                    navController.navigate(Screen.Sales.route) {
                        popUpTo(Screen.Sales.route) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Screen.QrPayment.route,
            arguments = listOf(
                navArgument("saleId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val saleId = backStackEntry.arguments?.getString("saleId") ?: ""
            QrPaymentScreen(
                saleId = saleId,
                total = total,
                onBack = { navController.popBackStack() },
                onPaymentSuccess = {
                    onPaymentSuccess()
                    navController.navigate(Screen.Sales.route) {
                        popUpTo(Screen.Sales.route) { inclusive = true }
                    }
                },
                onPaymentFailed = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
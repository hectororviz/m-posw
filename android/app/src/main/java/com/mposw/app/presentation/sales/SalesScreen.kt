package com.mposw.app.presentation.sales

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mposw.app.data.model.Category
import com.mposw.app.data.model.Product
import com.mposw.app.domain.model.CartItem
import com.mposw.app.domain.model.CartState
import com.mposw.app.presentation.theme.MPOSwTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    onCheckoutClick: () -> Unit,
    viewModel: SalesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val cartState by viewModel.cartState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        topBar = {
            SalesTopBar(
                storeName = uiState.settings?.storeName ?: "m-POSw",
                userName = uiState.userName,
                onLogout = { viewModel.logout() },
                isAdmin = uiState.isAdmin
            )
        }
    ) { padding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (cartState.isEmpty || !cartState.isCollapsed) {
                CategoriesSidebar(
                    categories = uiState.categories,
                    selectedCategoryId = uiState.selectedCategoryId,
                    onCategorySelect = { viewModel.selectCategory(it) },
                    modifier = Modifier
                        .width(100.dp)
                        .fillMaxHeight()
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(12.dp)
            ) {
                Text(
                    text = uiState.selectedCategory?.name ?: "Productos",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MPOSwTheme.colors().textPrimary,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                if (uiState.isLoadingProducts) {
                    Box(
                        modifier = Modifier.weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 140.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(uiState.products) { product ->
                            ProductCard(
                                product = product,
                                onClick = { viewModel.addToCart(product) }
                            )
                        }
                    }
                }
            }

            CartPanel(
                cartState = cartState,
                onUpdateQuantity = { productId, qty -> viewModel.updateCartQuantity(productId, qty) },
                onRemove = { viewModel.removeFromCart(it) },
                onCheckout = onCheckoutClick,
                modifier = Modifier
                    .width(if (cartState.isCollapsed) 72.dp else 320.dp)
                    .fillMaxHeight()
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesTopBar(
    storeName: String,
    userName: String?,
    onLogout: () -> Unit,
    isAdmin: Boolean,
    modifier: Modifier = Modifier
) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = storeName.firstOrNull()?.uppercase() ?: "M",
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = storeName,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        },
        actions = {
            if (isAdmin) {
                IconButton(onClick = { /* Navigate to admin */ }) {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = "Admin",
                        tint = Color.White
                    )
                }
            }
            Text(
                text = userName ?: "",
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
            IconButton(onClick = onLogout) {
                Icon(
                    Icons.Default.Logout,
                    contentDescription = "Cerrar sesión",
                    tint = Color.White
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MPOSwTheme.colors().accent
        ),
        modifier = modifier
    )
}

@Composable
fun CategoriesSidebar(
    categories: List<Category>,
    selectedCategoryId: String,
    onCategorySelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(MPOSwTheme.colors().surface)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        categories.forEach { category ->
            CategoryChip(
                category = category,
                isSelected = category.id == selectedCategoryId,
                onClick = { onCategorySelect(category.id) }
            )
        }
    }
}

@Composable
fun CategoryChip(
    category: Category,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor = if (isSelected) MPOSwTheme.colors().accent else MPOSwTheme.colors().background
    val textColor = if (isSelected) Color.White else MPOSwTheme.colors().textPrimary

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = backgroundColor,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = category.iconName,
                fontSize = 20.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = category.name,
                fontWeight = FontWeight.Medium,
                color = textColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                fontSize = 12.sp
            )
        }
    }
}

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = try {
        Color(android.graphics.Color.parseColor(product.colorHex ?: "#1f2937"))
    } catch (e: Exception) {
        Color(0xFF1f2937)
    }

    Card(
        onClick = onClick,
        modifier = modifier.size(140.dp),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(backgroundColor)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = product.iconName ?: "local_cafe",
                    fontSize = 32.sp,
                    color = Color.White.copy(alpha = 0.9f)
                )

                Column {
                    Text(
                        text = product.name,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color.Black.copy(alpha = 0.85f)
                    ) {
                        Text(
                            text = "$${String.format("%.2f", product.price)}",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun CartPanel(
    cartState: CartState,
    onUpdateQuantity: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
    onCheckout: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.padding(8.dp),
        shape = RoundedCornerShape(16.dp),
        color = MPOSwTheme.colors().surface,
        tonalElevation = 4.dp
    ) {
        if (cartState.isCollapsed) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    BadgedBox(
                        badge = {
                            if (cartState.itemCount > 0) {
                                Badge { Text(cartState.itemCount.toString()) }
                            }
                        }
                    ) {
                        Icon(
                            Icons.Default.ShoppingCart,
                            contentDescription = "Carrito",
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Carrito",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "${cartState.itemCount} items",
                        color = MPOSwTheme.colors().textSecondary
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (cartState.isEmpty) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Carrito vacío",
                            color = MPOSwTheme.colors().textSecondary
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        cartState.items.forEach { item ->
                            CartItemRow(
                                item = item,
                                onUpdateQuantity = { qty -> onUpdateQuantity(item.product.id, qty) },
                                onRemove = { onRemove(item.product.id) }
                            )
                        }
                    }
                }

                if (!cartState.isEmpty) {
                    Divider()
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Total",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "$${String.format("%.2f", cartState.total)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    }
                }

                Button(
                    onClick = onCheckout,
                    enabled = !cartState.isEmpty,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Cobrar", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
fun CartItemRow(
    item: CartItem,
    onUpdateQuantity: (Int) -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.product.name,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "$${String.format("%.2f", item.subtotal)}",
                color = MPOSwTheme.colors().textSecondary,
                fontSize = 12.sp
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { onUpdateQuantity(item.quantity - 1) },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(Icons.Default.Remove, contentDescription = "Restar", modifier = Modifier.size(16.dp))
            }
            Text(
                text = item.quantity.toString(),
                fontWeight = FontWeight.Bold,
                modifier = Modifier.width(32.dp),
                textAlign = TextAlign.Center
            )
            IconButton(
                onClick = { onUpdateQuantity(item.quantity + 1) },
                modifier = Modifier.size(32.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Sumar", modifier = Modifier.size(16.dp))
            }
        }

        IconButton(
            onClick = onRemove,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Eliminar",
                tint = MPOSwTheme.colors().error,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}
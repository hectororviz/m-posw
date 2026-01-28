import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'pickers.dart';

const bool kEnableSymbolIcons = bool.fromEnvironment(
  'ENABLE_SYMBOL_ICONS',
  defaultValue: false,
);

class AppConfig {
  static final String apiBaseUrl = _loadApiBaseUrl();

  static String _loadApiBaseUrl() {
    String? fromWindow;
    final dynamic config = (html.window as dynamic).__APP_CONFIG__;
    if (config != null) {
      final dynamic value = config.API_BASE_URL ?? config['API_BASE_URL'];
      if (value is String) {
        fromWindow = value;
      }
    }
    if (fromWindow != null && fromWindow.trim().isNotEmpty) {
      return _normalizeBaseUrl(fromWindow);
    }
    const envValue = String.fromEnvironment('API_BASE_URL');
    if (envValue.isNotEmpty) {
      return _normalizeBaseUrl(envValue);
    }
    return _normalizeBaseUrl('${html.window.location.origin}/api');
  }

  static String _normalizeBaseUrl(String value) {
    var trimmed = value.trim();
    if (trimmed.endsWith('/')) {
      trimmed = trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }
}

final Map<int, String> _numpadTextMap = {
  LogicalKeyboardKey.numpad0.keyId: '0',
  LogicalKeyboardKey.numpad1.keyId: '1',
  LogicalKeyboardKey.numpad2.keyId: '2',
  LogicalKeyboardKey.numpad3.keyId: '3',
  LogicalKeyboardKey.numpad4.keyId: '4',
  LogicalKeyboardKey.numpad5.keyId: '5',
  LogicalKeyboardKey.numpad6.keyId: '6',
  LogicalKeyboardKey.numpad7.keyId: '7',
  LogicalKeyboardKey.numpad8.keyId: '8',
  LogicalKeyboardKey.numpad9.keyId: '9',
};

const int _maxImageBytes = 3 * 1024 * 1024;

KeyEventResult _handleNumpadInput(
  TextEditingController controller,
  KeyEvent event, {
  bool allowDecimal = false,
}) {
  if (event is! KeyDownEvent) {
    return KeyEventResult.ignored;
  }
  String? insertText = _numpadTextMap[event.logicalKey.keyId];
  if (insertText == null && allowDecimal && event.logicalKey == LogicalKeyboardKey.numpadDecimal) {
    insertText = '.';
  }
  if (insertText == null) {
    return KeyEventResult.ignored;
  }
  final text = controller.text;
  final selection = controller.selection;
  final start = selection.start >= 0 ? selection.start : text.length;
  final end = selection.end >= 0 ? selection.end : text.length;
  final newText = text.replaceRange(start, end, insertText);
  controller.value = controller.value.copyWith(
    text: newText,
    selection: TextSelection.collapsed(offset: start + insertText.length),
    composing: TextRange.empty,
  );
  return KeyEventResult.handled;
}

class _SelectedImage {
  _SelectedImage({required this.bytes, required this.filename, required this.mimeType});

  final Uint8List bytes;
  final String filename;
  final String mimeType;
}

String? _mimeTypeFromFilename(String filename) {
  final parts = filename.split('.');
  if (parts.length < 2) return null;
  final ext = parts.last.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (kDebugMode) {
    debugPrint('API base URL: ${AppConfig.apiBaseUrl}');
  }
  final token = await AuthTokenStore.load();
  runApp(MiBpsApp(initialToken: token));
}

String? _roleFromToken(String? token) {
  if (token == null || token.isEmpty) {
    return null;
  }
  final parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
    final decoded = jsonDecode(payload);
    if (decoded is Map<String, dynamic>) {
      final role = decoded['role'];
      return role?.toString();
    }
  } catch (_) {
    return null;
  }
  return null;
}

class MiBpsApp extends StatefulWidget {
  const MiBpsApp({super.key, this.initialToken});

  final String? initialToken;

  @override
  State<MiBpsApp> createState() => _MiBpsAppState();
}

class _MiBpsAppState extends State<MiBpsApp> {
  late final ValueNotifier<String?> authState;
  final settings = ValueNotifier<Setting?>(null);
  final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    authState = ValueNotifier<String?>(widget.initialToken);
    ApiClient.initialize(
      tokenProvider: () => authState.value,
      onUnauthorized: _handleUnauthorized,
    );
    ApiService().getSettings().then((value) {
      settings.value = value;
    });
  }

  Future<void> _handleUnauthorized() async {
    await AuthTokenStore.clear();
    authState.value = null;
    scaffoldMessengerKey.currentState?.showSnackBar(
      const SnackBar(content: Text('Sesión expirada. Inicia sesión nuevamente.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Setting?>(
      valueListenable: settings,
      builder: (context, setting, _) {
        final themeColor = setting?.accentColor != null
            ? Color(hexToColor(setting!.accentColor!))
            : const Color(0xFF0EA5E9);
        final faviconUrl = setting?.faviconUrl;
        if (faviconUrl != null && faviconUrl.isNotEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            updateFavicon(resolveApiUrl(faviconUrl));
          });
        }
        return MaterialApp(
          title: setting?.storeName ?? 'MiBPS',
          scaffoldMessengerKey: scaffoldMessengerKey,
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: themeColor),
            useMaterial3: true,
            visualDensity: VisualDensity.standard,
          ),
          home: ValueListenableBuilder<String?>(
            valueListenable: authState,
            builder: (context, token, _) {
              if (token == null) {
                return LoginScreen(
                  onLoggedIn: (newToken) async {
                    await AuthTokenStore.save(newToken);
                    authState.value = newToken;
                    settings.value = await ApiService().getSettings();
                  },
                );
              }
              return HomeShell(
                authState: authState,
                settingNotifier: settings,
              );
            },
          ),
        );
      },
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.authState, required this.settingNotifier});

  final ValueNotifier<String?> authState;
  final ValueNotifier<Setting?> settingNotifier;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String?>(
      valueListenable: widget.authState,
      builder: (context, token, _) {
        final role = _roleFromToken(token);
        final isAdmin = role == 'ADMIN';
        final destinations = [
          _Destination('POS', Icons.storefront, const PosScreen()),
          if (isAdmin) _Destination('Admin', Icons.admin_panel_settings, const AdminScreen()),
          if (isAdmin) _Destination('Reportes', Icons.receipt_long, const ReportsScreen()),
          if (isAdmin) _Destination('Estadísticas', Icons.bar_chart, const StatsScreen()),
          if (isAdmin)
            _Destination(
              'Personalización',
              Icons.palette,
              SettingsScreen(settingNotifier: widget.settingNotifier),
            ),
        ];

        final maxIndex = destinations.length - 1;
        final effectiveIndex = selectedIndex.clamp(0, maxIndex);
        if (effectiveIndex != selectedIndex) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              setState(() => selectedIndex = effectiveIndex);
            }
          });
        }

        return LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 900;
            return Scaffold(
              appBar: AppBar(
                title: ValueListenableBuilder<Setting?>(
                  valueListenable: widget.settingNotifier,
                  builder: (context, setting, _) {
                    final logoUrl = (setting?.logoUrl?.isNotEmpty ?? false)
                        ? resolveApiUrl(setting!.logoUrl!)
                        : null;
                    return Row(
                      children: [
                        if (logoUrl != null)
                          Padding(
                            padding: const EdgeInsets.only(right: 12),
                            child: CircleAvatar(backgroundImage: NetworkImage(logoUrl)),
                          ),
                        Text(setting?.storeName ?? 'MiBPS'),
                      ],
                    );
                  },
                ),
                actions: [
                  TextButton.icon(
                    onPressed: () async {
                      try {
                        await ApiService().logout();
                      } catch (_) {
                        // Ignore logout failures.
                      }
                      await AuthTokenStore.clear();
                      widget.authState.value = null;
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('Salir'),
                  ),
                ],
              ),
              body: Row(
                children: [
                  if (isWide)
                    NavigationRail(
                      selectedIndex: effectiveIndex,
                      onDestinationSelected: (value) => setState(() => selectedIndex = value),
                      destinations: destinations
                          .map((item) => NavigationRailDestination(
                                icon: Icon(item.icon),
                                label: Text(item.label),
                              ))
                          .toList(),
                    ),
                  Expanded(child: destinations[effectiveIndex].screen),
                ],
              ),
              bottomNavigationBar: isWide
                  ? null
                  : NavigationBar(
                      selectedIndex: effectiveIndex,
                      onDestinationSelected: (value) => setState(() => selectedIndex = value),
                      destinations: destinations
                          .map((item) => NavigationDestination(icon: Icon(item.icon), label: item.label))
                          .toList(),
                    ),
            );
          },
        );
      },
    );
  }
}

class _Destination {
  _Destination(this.label, this.icon, this.screen);

  final String label;
  final IconData icon;
  final Widget screen;
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLoggedIn});

  final ValueChanged<String> onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();
  bool loading = false;
  String? error;

  String _buildLoginErrorMessage(LoginException exception) {
    final statusCode = exception.statusCode;
    if (statusCode == 400) {
      final details = exception.backendMessage?.trim();
      if (details != null && details.isNotEmpty) {
        return 'Datos inválidos\n$details';
      }
      return 'Datos inválidos';
    }
    if (statusCode == 401 || statusCode == 403) {
      return 'Credenciales inválidas';
    }
    return 'Error inesperado';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Card(
          margin: const EdgeInsets.all(24),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Ingreso MiBPS', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 16),
                  TextField(
                    controller: usernameController,
                    decoration: const InputDecoration(labelText: 'Email/Usuario'),
                    autofillHints: const [],
                    enableSuggestions: false,
                    autocorrect: false,
                    keyboardType: TextInputType.text,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  Focus(
                    onKeyEvent: (node, event) => _handleNumpadInput(passwordController, event),
                    child: TextField(
                      controller: passwordController,
                      decoration: const InputDecoration(labelText: 'Contraseña'),
                      obscureText: true,
                      autofillHints: const [],
                      enableSuggestions: false,
                      autocorrect: false,
                      textInputAction: TextInputAction.done,
                    ),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(error!, style: const TextStyle(color: Colors.red)),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: loading
                        ? null
                        : () async {
                            setState(() {
                              loading = true;
                              error = null;
                            });
                            try {
                              final token = await ApiService()
                                  .login(usernameController.text, passwordController.text);
                              widget.onLoggedIn(token);
                            } on LoginException catch (e) {
                              final message = _buildLoginErrorMessage(e);
                              setState(() => error = message);
                            } on TimeoutException {
                              setState(() => error = 'Error de conexión');
                            } on http.ClientException {
                              setState(() => error = 'Error de conexión');
                            } catch (_) {
                              setState(() => error = 'Error inesperado');
                            } finally {
                              setState(() => loading = false);
                            }
                          },
                  child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      child: Text(loading ? 'Ingresando...' : 'Ingresar'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  static final Map<LogicalKeyboardKey, int> _digitKeys = <LogicalKeyboardKey, int>{
    LogicalKeyboardKey.digit0: 0,
    LogicalKeyboardKey.digit1: 1,
    LogicalKeyboardKey.digit2: 2,
    LogicalKeyboardKey.digit3: 3,
    LogicalKeyboardKey.digit4: 4,
    LogicalKeyboardKey.digit5: 5,
    LogicalKeyboardKey.digit6: 6,
    LogicalKeyboardKey.digit7: 7,
    LogicalKeyboardKey.digit8: 8,
    LogicalKeyboardKey.digit9: 9,
    LogicalKeyboardKey.numpad0: 0,
    LogicalKeyboardKey.numpad1: 1,
    LogicalKeyboardKey.numpad2: 2,
    LogicalKeyboardKey.numpad3: 3,
    LogicalKeyboardKey.numpad4: 4,
    LogicalKeyboardKey.numpad5: 5,
    LogicalKeyboardKey.numpad6: 6,
    LogicalKeyboardKey.numpad7: 7,
    LogicalKeyboardKey.numpad8: 8,
    LogicalKeyboardKey.numpad9: 9,
  };
  final cart = <String, CartItem>{};
  final FocusNode _keyboardFocusNode = FocusNode(debugLabel: 'PosKeyboard');
  final ProductCache _productCache = ProductCache.instance;
  Category? selectedCategory;
  String _quantityBuffer = '';
  String? _selectedItemId;
  bool _isCartCollapsed = false;
  bool _didSetInitialCartState = false;
  bool _isLoadingProducts = false;
  List<Product> _categoryProducts = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _keyboardFocusNode.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _keyboardFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadProductsForCategory(String categoryId) async {
    final cachedProducts = _productCache.getFresh(categoryId);
    if (cachedProducts != null) {
      setState(() {
        _categoryProducts = cachedProducts;
        _isLoadingProducts = false;
      });
      return;
    }
    setState(() {
      _isLoadingProducts = true;
      _categoryProducts = [];
    });
    try {
      final products = await ApiService().getProducts(categoryId);
      _productCache.set(categoryId, products);
      if (!mounted || selectedCategory?.id != categoryId) {
        return;
      }
      setState(() {
        _categoryProducts = products;
        _isLoadingProducts = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoadingProducts = false;
      });
    }
  }

  void _selectCategory(Category category) {
    setState(() {
      selectedCategory = category;
    });
    _loadProductsForCategory(category.id);
  }

  Widget _buildProductsGrid(BuildContext context) {
    if (_isLoadingProducts && _categoryProducts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (kDebugMode) {
      final selectedCategoryId = selectedCategory?.id;
      final matchingCount = selectedCategoryId == null
          ? 0
          : _categoryProducts.where((product) => product.categoryId == selectedCategoryId).length;
      debugPrint(
        'Products view -> selectedCategoryId=$selectedCategoryId '
        'products=${_categoryProducts.length} matching=$matchingCount',
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.1,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _categoryProducts.length,
      itemBuilder: (context, index) {
        final product = _categoryProducts[index];
        final background = colorFromHex(product.colorHex) ??
            colorFromHex(selectedCategory?.colorHex) ??
            Theme.of(context).colorScheme.primaryContainer;
        final foreground = foregroundColorFor(background);
        final imageUrl = resolveImageUrl(
          product.imagePath,
          product.imageUpdatedAt,
        );
        return FilledButton(
          style: FilledButton.styleFrom(
            padding: EdgeInsets.zero,
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: background, width: 3),
            ),
          ),
          onPressed: () {
            final quantity = _quantityValue ?? 1;
            setState(() {
              if (_selectedItemId != null && _quantityValue != null) {
                cart.update(
                  _selectedItemId!,
                  (value) => value.copyWith(quantity: quantity),
                );
                _quantityBuffer = '';
              } else {
                cart.update(
                  product.id,
                  (value) => value.copyWith(quantity: value.quantity + quantity),
                  ifAbsent: () => CartItem(product: product, quantity: quantity),
                );
                _quantityBuffer = '';
              }
              _selectedItemId = null;
            });
          },
          child: Stack(
            children: [
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: buildFillImageOrFallback(
                    imageUrl: imageUrl,
                    name: product.name,
                    backgroundColor: background,
                    foregroundColor: foreground,
                    cacheSize: 256,
                  ),
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '\$${product.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      focusNode: _keyboardFocusNode,
      onKeyEvent: _handleKeyEvent,
      child: FutureBuilder<List<Category>>(
        future: ApiService().getCategories(),
        builder: (context, snapshot) {
          final categories = snapshot.data ?? [];
          final showingProducts = selectedCategory != null;
          return LayoutBuilder(
            builder: (context, constraints) {
              final isCompact = constraints.maxWidth < 900;
              if (!_didSetInitialCartState) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) {
                    setState(() {
                      _isCartCollapsed = isCompact;
                      _didSetInitialCartState = true;
                    });
                  }
                });
              }
              final showCart = !_isCartCollapsed;
              final showProducts = !isCompact || !showCart;
              return Column(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        if (showProducts)
                          Expanded(
                            flex: isCompact ? 1 : 3,
                            child: Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: showingProducts
                                      ? Column(
                                          crossAxisAlignment: CrossAxisAlignment.stretch,
                                          children: [
                                            FilledButton.icon(
                                              onPressed: () => setState(() => selectedCategory = null),
                                              icon: const Icon(Icons.arrow_back),
                                              label: const Text('Volver a categorías'),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              selectedCategory!.name,
                                              style: Theme.of(context).textTheme.titleMedium,
                                              textAlign: TextAlign.center,
                                            ),
                                          ],
                                        )
                                      : Text('Categorías', style: Theme.of(context).textTheme.titleLarge),
                                ),
                                Expanded(
                                  child: showingProducts
                                      ? _buildProductsGrid(context)
                                      : GridView.builder(
                                          padding: const EdgeInsets.all(16),
                                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                            crossAxisCount: 2,
                                            childAspectRatio: 1.2,
                                            crossAxisSpacing: 12,
                                            mainAxisSpacing: 12,
                                          ),
                                          itemCount: categories.length,
                                          itemBuilder: (context, index) {
                                            final category = categories[index];
                                            final background = colorFromHex(category.colorHex) ??
                                                Theme.of(context).colorScheme.primaryContainer;
                                            final foreground = foregroundColorFor(background);
                                            final imageUrl = resolveImageUrl(
                                              category.imagePath,
                                              category.imageUpdatedAt,
                                            );
                                            return InkWell(
                                              borderRadius: BorderRadius.circular(16),
                                              onTap: () {
                                                if (kDebugMode) {
                                                  debugPrint('Selected category: ${category.id}');
                                                }
                                                _selectCategory(category);
                                              },
                                              child: Ink(
                                                decoration: BoxDecoration(
                                                  border: Border.all(color: background, width: 3),
                                                  borderRadius: BorderRadius.circular(16),
                                                ),
                                                child: Padding(
                                                  padding: const EdgeInsets.all(6),
                                                  child: buildFillImageOrFallback(
                                                    imageUrl: imageUrl,
                                                    name: category.name,
                                                    backgroundColor: background,
                                                    foregroundColor: foreground,
                                                    cacheSize: 256,
                                                  ),
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                ),
                              ],
                            ),
                          ),
                        if (showCart)
                          Expanded(
                            flex: isCompact ? 1 : 2,
                            child: Container(
                              color: Theme.of(context).colorScheme.surfaceVariant,
                              child: Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text('Carrito', style: Theme.of(context).textTheme.titleLarge),
                                        IconButton(
                                          tooltip: 'Colapsar carrito',
                                          icon: Icon(isCompact ? Icons.close : Icons.chevron_right),
                                          onPressed: () => setState(() => _isCartCollapsed = true),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: Row(
                                      children: [
                                        Text(
                                          'Cantidad rápida:',
                                          style: Theme.of(context).textTheme.bodyMedium,
                                        ),
                                        const SizedBox(width: 8),
                                        Chip(
                                          label: Text(_quantityBuffer.isEmpty ? '—' : _quantityBuffer),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Expanded(
                                    child: ListView(
                                      children: cart.values
                                          .map(
                                            (item) => ListTile(
                                              selected: _selectedItemId == item.product.id,
                                              onTap: () => setState(() => _selectedItemId = item.product.id),
                                              title: Text(item.product.name),
                                              subtitle: Text('x${item.quantity}'),
                                              trailing: Text('\$${item.total.toStringAsFixed(2)}'),
                                              leading: IconButton(
                                                icon: const Icon(Icons.remove_circle_outline),
                                                onPressed: () {
                                                  setState(() {
                                                    if (item.quantity <= 1) {
                                                      cart.remove(item.product.id);
                                                      if (_selectedItemId == item.product.id) {
                                                        _selectedItemId = null;
                                                      }
                                                    } else {
                                                      cart.update(
                                                        item.product.id,
                                                        (value) => value.copyWith(quantity: value.quantity - 1),
                                                      );
                                                    }
                                                  });
                                                },
                                              ),
                                            ),
                                          )
                                          .toList(),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  SafeArea(
                    top: false,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 8,
                            offset: Offset(0, -2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          if (_isCartCollapsed)
                            FilledButton.tonalIcon(
                              onPressed: () => setState(() => _isCartCollapsed = false),
                              icon: const Icon(Icons.chevron_left),
                              label: const Text('Mostrar carrito'),
                            ),
                          if (_isCartCollapsed) const SizedBox(width: 12),
                          Expanded(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Total',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                Text(
                                  '\$${cartTotal.toStringAsFixed(2)}',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          FilledButton(
                            onPressed: cart.isEmpty ? null : () => _startCheckout(context),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Text('Cobrar / Confirmar venta'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  double get cartTotal => cart.values.fold(0, (sum, item) => sum + item.total);

  bool _isTextFieldFocused() {
    final focusedContext = FocusManager.instance.primaryFocus?.context;
    if (focusedContext == null) {
      return false;
    }
    return focusedContext.widget is EditableText;
  }

  int? get _quantityValue {
    if (_quantityBuffer.isEmpty) {
      return null;
    }
    final parsed = int.tryParse(_quantityBuffer);
    if (parsed == null || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) {
      return KeyEventResult.ignored;
    }
    if (_isTextFieldFocused()) {
      return KeyEventResult.ignored;
    }
    final digit = _digitFromKey(event.logicalKey);
    if (digit != null) {
      setState(() {
        _quantityBuffer = (_quantityBuffer + digit.toString()).replaceFirst(RegExp(r'^0+'), '');
        if (_quantityBuffer.isEmpty) {
          _quantityBuffer = digit.toString();
        }
      });
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.backspace ||
        event.logicalKey == LogicalKeyboardKey.delete) {
      setState(() {
        if (_quantityBuffer.isNotEmpty) {
          _quantityBuffer = _quantityBuffer.substring(0, _quantityBuffer.length - 1);
        } else if (_selectedItemId != null) {
          cart.remove(_selectedItemId);
          _selectedItemId = null;
        }
      });
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.numpadEnter) {
      _handleEnterAction();
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      setState(() {
        _quantityBuffer = '';
        _selectedItemId = null;
      });
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  int? _digitFromKey(LogicalKeyboardKey key) {
    return _digitKeys[key];
  }

  Future<void> _handleEnterAction() async {
    if (_selectedItemId != null && _quantityValue != null) {
      setState(() {
        cart.update(
          _selectedItemId!,
          (value) => value.copyWith(quantity: _quantityValue!),
        );
        _quantityBuffer = '';
      });
      return;
    }
    if (cart.isEmpty) {
      return;
    }
    await _startCheckout(context);
  }

  Future<void> _startCheckout(BuildContext context) async {
    final selected = await _showPaymentSelectionDialog(context);
    if (selected == null) {
      return;
    }
    if (selected.type == PaymentMethodType.cash) {
      final confirmed = await _showCashPaymentDialog(context, selected);
      if (!confirmed) {
        return;
      }
      await _submitSale(context);
      return;
    }
    if (selected.type == PaymentMethodType.mercadoPagoQr) {
      await _startMercadoPagoPayment(context);
    }
  }

  Future<PaymentMethod?> _showPaymentSelectionDialog(BuildContext context) {
    return showDialog<PaymentMethod>(
      context: context,
      builder: (context) {
        final available = [
          PaymentMethod.cash(),
          PaymentMethod.mercadoPagoQr(),
        ];
        return AlertDialog(
          title: const Text('Elegí un medio de pago'),
          content: SizedBox(
            width: 360,
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: available.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final method = available[index];
                return ListTile(
                  leading: Icon(method.type.icon),
                  title: Text(method.name),
                  subtitle: Text(method.type.label),
                  onTap: () => Navigator.of(context).pop(method),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
          ],
        );
      },
    );
  }

  Future<bool> _showCashPaymentDialog(BuildContext context, PaymentMethod method) async {
    final controller = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final received = _parseAmount(controller.text);
            final total = cartTotal;
            final change = received - total;
            final isEnough = received >= total;
            return AlertDialog(
              title: Text('Pago en ${method.name}'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Total: \$${total.toStringAsFixed(2)}'),
                  const SizedBox(height: 12),
                  Focus(
                    onKeyEvent: (node, event) =>
                        _handleNumpadInput(controller, event, allowDecimal: true),
                    child: TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Monto recibido'),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(isEnough ? 'Vuelto' : 'Falta'),
                      Text(
                        '\$${change.abs().toStringAsFixed(2)}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isEnough ? Colors.green : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: isEnough ? () => Navigator.of(context).pop(true) : null,
                  child: const Text('Confirmar cobro'),
                ),
              ],
            );
          },
        );
      },
    );
    controller.dispose();
    return result ?? false;
  }

  double _parseAmount(String value) {
    final normalized = value.replaceAll(',', '.');
    return double.tryParse(normalized) ?? 0;
  }

  Future<void> _submitSale(BuildContext context) async {
    await ApiService().createSale(cart.values.toList());
    setState(() {
      cart.clear();
      _quantityBuffer = '';
      _selectedItemId = null;
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Venta registrada')),
      );
    }
  }

  Future<void> _startMercadoPagoPayment(BuildContext context) async {
    try {
      final createdSale = await ApiService().createSale(cart.values.toList());
      await ApiService().startMercadoPagoPayment(createdSale.id);
      final paid = await _showMercadoPagoWaitingDialog(context, createdSale);
      if (paid) {
        setState(() {
          cart.clear();
          _quantityBuffer = '';
          _selectedItemId = null;
        });
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Pago confirmado')),
          );
        }
      }
    } catch (err) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  Future<bool> _showMercadoPagoWaitingDialog(BuildContext context, Sale sale) async {
    final statusNotifier = ValueNotifier<String>(sale.status);
    Timer? timer;

    Future<void> pollSale() async {
      try {
        final updated = await ApiService().getSale(sale.id);
        statusNotifier.value = updated.status;
        if (updated.status == 'PAID' || updated.status == 'CANCELLED' || updated.status == 'EXPIRED') {
          timer?.cancel();
          if (context.mounted) {
            Navigator.of(context).pop(updated.status == 'PAID');
          }
        }
      } catch (_) {
        // Ignore polling errors for now.
      }
    }

    timer = Timer.periodic(const Duration(seconds: 2), (_) => pollSale());

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Esperando pago...'),
          content: ValueListenableBuilder<String>(
            valueListenable: statusNotifier,
            builder: (context, status, _) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Total: \$${sale.total.toStringAsFixed(2)}'),
                  const SizedBox(height: 12),
                  Text('Estado: $status'),
                ],
              );
            },
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await ApiService().cancelMercadoPagoPayment(sale.id);
                timer?.cancel();
                if (context.mounted) {
                  Navigator.of(context).pop(false);
                }
              },
              child: const Text('Cancelar'),
            ),
          ],
        );
      },
    );

    timer?.cancel();
    statusNotifier.dispose();
    return result ?? false;
  }
}

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  @override
  Widget build(BuildContext context) {
    final tabs = [
      _AdminTab('Usuarios', const AdminUsersTab()),
      _AdminTab('Categorías', const AdminCategoriesTab()),
      _AdminTab('Productos', const AdminProductsTab()),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Column(
        children: [
          TabBar(
            labelStyle: Theme.of(context).textTheme.titleMedium,
            tabs: tabs.map((tab) => Tab(text: tab.title)).toList(),
          ),
          Expanded(
            child: TabBarView(
              children: tabs.map((tab) => tab.content).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminTab {
  _AdminTab(this.title, this.content);
  final String title;
  final Widget content;
}

class AdminUsersTab extends StatefulWidget {
  const AdminUsersTab({super.key});

  @override
  State<AdminUsersTab> createState() => _AdminUsersTabState();
}

class _AdminUsersTabState extends State<AdminUsersTab> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<User>>(
      future: ApiService().getUsers(),
      builder: (context, snapshot) {
        final users = snapshot.data ?? [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton.icon(
              onPressed: () async {
                await showDialog(
                  context: context,
                  builder: (context) => const UserDialog(),
                );
                setState(() {});
              },
              icon: const Icon(Icons.person_add),
              label: const Text('Crear usuario'),
            ),
            const SizedBox(height: 16),
            ...users.map(
              (user) => Card(
                child: ListTile(
                  title: Text(user.name),
                  subtitle: Text(
                    '${user.email ?? 'Sin correo'} · ${user.role}'
                    '${user.externalPosId != null ? ' · POS: ${user.externalPosId}' : ''}',
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Cambiar contraseña',
                        icon: const Icon(Icons.lock_reset),
                        onPressed: () async {
                          await showDialog(
                            context: context,
                            builder: (context) => ChangeUserPasswordDialog(user: user),
                          );
                        },
                      ),
                      Switch(
                        value: user.active,
                        onChanged: (value) async {
                          await ApiService().updateUser(user.id, active: value);
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class AdminCategoriesTab extends StatefulWidget {
  const AdminCategoriesTab({super.key});

  @override
  State<AdminCategoriesTab> createState() => _AdminCategoriesTabState();
}

class _AdminCategoriesTabState extends State<AdminCategoriesTab> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Category>>(
      future: ApiService().getCategoriesAll(),
      builder: (context, snapshot) {
        final categories = snapshot.data ?? [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton.icon(
              onPressed: () async {
                await showDialog(context: context, builder: (context) => const CategoryDialog());
                setState(() {});
              },
              icon: const Icon(Icons.add),
              label: const Text('Crear categoría'),
            ),
            const SizedBox(height: 16),
            ...categories.map(
              (category) => Card(
                child: ListTile(
                  leading: buildCircleImageOrFallback(
                    imageUrl: resolveImageUrl(category.imagePath, category.imageUpdatedAt),
                    name: category.name,
                    backgroundColor:
                        colorFromHex(category.colorHex) ?? Theme.of(context).colorScheme.primaryContainer,
                    foregroundColor: foregroundColorFor(
                      colorFromHex(category.colorHex) ?? Theme.of(context).colorScheme.primaryContainer,
                    ),
                    size: 40,
                  ),
                  title: Text(category.name),
                  subtitle: Text(category.colorHex),
                  onTap: () async {
                    await showDialog(
                      context: context,
                      builder: (context) => CategoryDialog(category: category),
                    );
                    setState(() {});
                  },
                  trailing: Switch(
                    value: category.active,
                    onChanged: (value) async {
                      await ApiService()
                          .updateCategory(category.id, active: value);
                      setState(() {});
                    },
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class AdminProductsTab extends StatefulWidget {
  const AdminProductsTab({super.key});

  @override
  State<AdminProductsTab> createState() => _AdminProductsTabState();
}

class _AdminProductsTabState extends State<AdminProductsTab> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Product>>(
      future: ApiService().getProductsAll(),
      builder: (context, snapshot) {
        final products = snapshot.data ?? [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton.icon(
              onPressed: () async {
                await showDialog(context: context, builder: (context) => const ProductDialog());
                setState(() {});
              },
              icon: const Icon(Icons.add),
              label: const Text('Crear producto'),
            ),
            const SizedBox(height: 16),
            ...products.map(
              (product) => Card(
                child: ListTile(
                  leading: buildCircleImageOrFallback(
                    imageUrl: resolveImageUrl(product.imagePath, product.imageUpdatedAt),
                    name: product.name,
                    backgroundColor: colorFromHex(product.colorHex) ??
                        colorFromHex(product.categoryColorHex) ??
                        Theme.of(context).colorScheme.primaryContainer,
                    foregroundColor: foregroundColorFor(
                      colorFromHex(product.colorHex) ??
                          colorFromHex(product.categoryColorHex) ??
                          Theme.of(context).colorScheme.primaryContainer,
                    ),
                    size: 40,
                  ),
                  title: Text(product.name),
                  subtitle: Text('${product.categoryName} · \$${product.price.toStringAsFixed(2)}'),
                  onTap: () async {
                    await showDialog(
                      context: context,
                      builder: (context) => ProductDialog(product: product),
                    );
                    setState(() {});
                  },
                  trailing: Switch(
                    value: product.active,
                    onChanged: (value) async {
                      await ApiService()
                          .updateProduct(product.id, active: value, categoryId: product.categoryId);
                      setState(() {});
                    },
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  DateTime? from;
  DateTime? to;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              FilledButton.icon(
                onPressed: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: from ?? DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (date != null) {
                    setState(() => from = date);
                  }
                },
                icon: const Icon(Icons.date_range),
                label: Text(from == null ? 'Desde' : from!.toIso8601String().split('T').first),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: to ?? DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (date != null) {
                    setState(() => to = date);
                  }
                },
                icon: const Icon(Icons.event),
                label: Text(to == null ? 'Hasta' : to!.toIso8601String().split('T').first),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: () async {
                  final bytes = await ApiService().exportReport(from: from, to: to);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Excel generado (${bytes.length} bytes)')),
                    );
                  }
                },
                icon: const Icon(Icons.download),
                label: const Text('Descargar Excel'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: FutureBuilder<List<SummaryRow>>(
                    future: ApiService()
                        .summaryByProduct(from: from, to: to),
                    builder: (context, snapshot) {
                      final rows = snapshot.data ?? [];
                      return ReportCard(title: 'Resumen por producto', rows: rows);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: FutureBuilder<List<SummaryRow>>(
                    future: ApiService()
                        .summaryByCategory(from: from, to: to),
                    builder: (context, snapshot) {
                      final rows = snapshot.data ?? [];
                      return ReportCard(title: 'Resumen por categoría', rows: rows);
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ReportCard extends StatelessWidget {
  const ReportCard({super.key, required this.title, required this.rows});

  final String title;
  final List<SummaryRow> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                children: rows
                    .map(
                      (row) => ListTile(
                        title: Text(row.name),
                        subtitle: Text('Cantidad: ${row.quantity}'),
                        trailing: Text('\$${row.total.toStringAsFixed(2)}'),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(
        children: [
          FutureBuilder<List<TotalRow>>(
            future: ApiService().totalsByDay(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return ChartCard(title: 'Ventas por día (últimos 15)', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<TotalRow>>(
            future: ApiService().totalsByMonth(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return ChartCard(title: 'Ventas por mes (últimos 6)', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<AverageRow>>(
            future: ApiService().averageByCategory(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return AverageCard(title: 'Promedio diario por categoría', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<AverageRow>>(
            future: ApiService().averageByProduct(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return AverageCard(title: 'Promedio diario por producto', rows: rows);
            },
          ),
        ],
      ),
    );
  }
}

class ChartCard extends StatelessWidget {
  const ChartCard({super.key, required this.title, required this.rows});

  final String title;
  final List<TotalRow> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SizedBox(
              height: 200,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  barGroups: rows
                      .asMap()
                      .entries
                      .map(
                        (entry) => BarChartGroupData(
                          x: entry.key,
                          barRods: [
                            BarChartRodData(toY: entry.value.total, color: Theme.of(context).colorScheme.primary),
                          ],
                        ),
                      )
                      .toList(),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= rows.length) {
                            return const SizedBox.shrink();
                          }
                          return Text(rows[index].label, style: const TextStyle(fontSize: 10));
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AverageCard extends StatelessWidget {
  const AverageCard({super.key, required this.title, required this.rows});

  final String title;
  final List<AverageRow> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            ...rows.map(
              (row) => ListTile(
                title: Text(row.name),
                trailing: Text('\$${row.averageDaily.toStringAsFixed(2)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.settingNotifier});

  final ValueNotifier<Setting?> settingNotifier;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final storeController = TextEditingController();
  final accentController = TextEditingController();
  bool uploadingLogo = false;
  bool uploadingFavicon = false;
  String? logoUrl;
  String? faviconUrl;

  @override
  void initState() {
    super.initState();
    final setting = widget.settingNotifier.value;
    storeController.text = setting?.storeName ?? '';
    accentController.text = setting?.accentColor ?? '';
    logoUrl = setting?.logoUrl;
    faviconUrl = setting?.faviconUrl;
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Personalización', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        TextField(controller: storeController, decoration: const InputDecoration(labelText: 'Nombre del comercio')),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _AssetPreview(
                label: 'Logo',
                imageUrl: logoUrl,
                placeholder: Icons.storefront,
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: uploadingLogo ? null : () => _uploadAsset(context, 'logo'),
              icon: const Icon(Icons.upload),
              label: Text(uploadingLogo ? 'Subiendo...' : 'Subir logo'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _AssetPreview(
                label: 'Favicon',
                imageUrl: faviconUrl,
                placeholder: Icons.favorite,
              ),
            ),
            const SizedBox(width: 12),
            FilledButton.icon(
              onPressed: uploadingFavicon ? null : () => _uploadAsset(context, 'favicon'),
              icon: const Icon(Icons.upload),
              label: Text(uploadingFavicon ? 'Subiendo...' : 'Subir favicon'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(controller: accentController, decoration: const InputDecoration(labelText: 'Color/acento (hex)')),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () async {
            final updated = await ApiService().updateSettings(
              storeName: storeController.text,
              accentColor: accentController.text,
            );
            widget.settingNotifier.value = updated;
            setState(() {
              logoUrl = updated.logoUrl;
              faviconUrl = updated.faviconUrl;
            });
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Personalización guardada')),
              );
            }
          },
          child: const Text('Guardar cambios'),
        ),
      ],
    );
  }

  Future<void> _uploadAsset(BuildContext context, String type) async {
    final accept = type == 'favicon' ? '.ico,image/png,image/svg+xml' : 'image/*';
    final picked = await _pickFile(accept);
    if (picked == null) {
      return;
    }
    setState(() {
      if (type == 'logo') {
        uploadingLogo = true;
      } else {
        uploadingFavicon = true;
      }
    });
    try {
      final updated = await ApiService().uploadSettingAsset(
        type: type,
        bytes: picked.bytes,
        filename: picked.filename,
        mimeType: picked.mimeType,
      );
      widget.settingNotifier.value = updated;
      setState(() {
        logoUrl = updated.logoUrl;
        faviconUrl = updated.faviconUrl;
      });
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${type == 'logo' ? 'Logo' : 'Favicon'} actualizado')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          uploadingLogo = false;
          uploadingFavicon = false;
        });
      }
    }
  }

  Future<_PickedFile?> _pickFile(String accept) async {
    final uploadInput = html.FileUploadInputElement()..accept = accept;
    uploadInput.click();
    await uploadInput.onChange.first;
    final file = uploadInput.files?.first;
    if (file == null) {
      return null;
    }
    final reader = html.FileReader();
    reader.readAsArrayBuffer(file);
    await reader.onLoad.first;
    final bytes = reader.result as Uint8List;
    return _PickedFile(bytes: bytes, filename: file.name, mimeType: file.type);
  }

}

class _PickedFile {
  _PickedFile({required this.bytes, required this.filename, required this.mimeType});

  final Uint8List bytes;
  final String filename;
  final String mimeType;
}

class _AssetPreview extends StatelessWidget {
  const _AssetPreview({required this.label, required this.imageUrl, required this.placeholder});

  final String label;
  final String? imageUrl;
  final IconData placeholder;

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = imageUrl != null && imageUrl!.isNotEmpty ? resolveApiUrl(imageUrl!) : null;
    return Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: Theme.of(context).colorScheme.surfaceVariant,
          backgroundImage: resolvedUrl != null ? NetworkImage(resolvedUrl) : null,
          child: resolvedUrl == null ? Icon(placeholder) : null,
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(label)),
      ],
    );
  }
}

class UserDialog extends StatefulWidget {
  const UserDialog({super.key});

  @override
  State<UserDialog> createState() => _UserDialogState();
}

class _UserDialogState extends State<UserDialog> {
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final externalPosController = TextEditingController();
  final externalStoreController = TextEditingController();
  String role = 'USER';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Crear usuario'),
      content: SingleChildScrollView(
        child: Column(
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Usuario')),
            TextField(controller: emailController, decoration: const InputDecoration(labelText: 'Email (opcional)')),
            Focus(
              onKeyEvent: (node, event) => _handleNumpadInput(passwordController, event),
              child: TextField(
                controller: passwordController,
                decoration: const InputDecoration(labelText: 'Contraseña'),
              ),
            ),
            DropdownButton<String>(
              value: role,
              items: const [
                DropdownMenuItem(value: 'USER', child: Text('USER')),
                DropdownMenuItem(value: 'ADMIN', child: Text('ADMIN')),
              ],
              onChanged: (value) => setState(() => role = value ?? 'USER'),
            ),
            TextField(
              controller: externalPosController,
              decoration: const InputDecoration(labelText: 'externalPosId (caja)'),
            ),
            TextField(
              controller: externalStoreController,
              decoration: const InputDecoration(labelText: 'externalStoreId (opcional)'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () async {
            try {
              await ApiService().createUser(
                name: nameController.text,
                email: emailController.text,
                password: passwordController.text,
                role: role,
                externalPosId: externalPosController.text,
                externalStoreId: externalStoreController.text,
              );
              if (context.mounted) {
                Navigator.pop(context);
              }
            } catch (err) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                );
              }
            }
          },
          child: const Text('Crear'),
        ),
      ],
    );
  }
}

class ChangeUserPasswordDialog extends StatefulWidget {
  const ChangeUserPasswordDialog({super.key, required this.user});

  final User user;

  @override
  State<ChangeUserPasswordDialog> createState() => _ChangeUserPasswordDialogState();
}

class _ChangeUserPasswordDialogState extends State<ChangeUserPasswordDialog> {
  final passwordController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Cambiar contraseña: ${widget.user.name}'),
      content: Focus(
        onKeyEvent: (node, event) => _handleNumpadInput(passwordController, event),
        child: TextField(
          controller: passwordController,
          decoration: const InputDecoration(labelText: 'Nueva contraseña'),
          obscureText: true,
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () async {
            final password = passwordController.text.trim();
            if (password.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Ingresa una contraseña válida.')),
              );
              return;
            }
            try {
              await ApiService().updateUserPassword(widget.user.id, password);
              if (context.mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Contraseña actualizada.')),
                );
              }
            } catch (err) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                );
              }
            }
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}

class CategoryDialog extends StatefulWidget {
  const CategoryDialog({super.key, this.category});

  final Category? category;

  @override
  State<CategoryDialog> createState() => _CategoryDialogState();
}

class _CategoryDialogState extends State<CategoryDialog> {
  final nameController = TextEditingController();
  String? colorHex;
  _SelectedImage? selectedImage;
  bool isUploadingImage = false;
  Category? imageCategory;

  @override
  void initState() {
    super.initState();
    nameController.text = widget.category?.name ?? '';
    colorHex = widget.category?.colorHex ?? '#0EA5E9';
    imageCategory = widget.category;
  }

  Future<void> _pickImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) {
      return;
    }
    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo leer el archivo seleccionado.')),
        );
      }
      return;
    }
    if (bytes.length > _maxImageBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('La imagen supera el tamaño máximo permitido (3MB).')),
        );
      }
      return;
    }
    final mimeType = _mimeTypeFromFilename(file.name);
    if (mimeType == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Formato de imagen no soportado.')),
        );
      }
      return;
    }
    setState(() {
      selectedImage = _SelectedImage(bytes: bytes, filename: file.name, mimeType: mimeType);
    });
  }

  Future<void> _uploadImage(String categoryId) async {
    final image = selectedImage;
    if (image == null) return;
    setState(() => isUploadingImage = true);
    try {
      final updated = await ApiService().uploadCategoryImage(
        id: categoryId,
        bytes: image.bytes,
        filename: image.filename,
        mimeType: image.mimeType,
      );
      if (mounted) {
        setState(() {
          imageCategory = updated;
          selectedImage = null;
        });
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isUploadingImage = false);
      }
    }
  }

  Future<void> _deleteImage(String categoryId) async {
    setState(() => isUploadingImage = true);
    try {
      final updated = await ApiService().deleteCategoryImage(categoryId);
      if (mounted) {
        setState(() {
          imageCategory = updated;
          selectedImage = null;
        });
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isUploadingImage = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.category == null ? 'Nueva categoría' : 'Editar categoría'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
            const SizedBox(height: 12),
            ColorPickerField(
              label: 'Color',
              value: colorHex,
              onChanged: (value) => setState(() => colorHex = value),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Imagen', style: Theme.of(context).textTheme.titleSmall),
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final imageUrl = resolveImageUrl(
                  imageCategory?.imagePath ?? widget.category?.imagePath,
                  imageCategory?.imageUpdatedAt ?? widget.category?.imageUpdatedAt,
                );
                Widget preview;
                if (selectedImage != null) {
                  preview = Image.memory(
                    selectedImage!.bytes,
                    width: 160,
                    height: 160,
                    fit: BoxFit.cover,
                  );
                } else if (imageUrl != null) {
                  preview = Image.network(
                    imageUrl,
                    width: 160,
                    height: 160,
                    fit: BoxFit.cover,
                  );
                } else {
                  preview = Container(
                    width: 160,
                    height: 160,
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    child: const Icon(Icons.image, size: 48),
                  );
                }
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: preview,
                );
              },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: isUploadingImage ? null : _pickImage,
                  icon: const Icon(Icons.upload_file),
                  label: const Text('Elegir archivo'),
                ),
                if (widget.category != null)
                  FilledButton(
                    onPressed: isUploadingImage || selectedImage == null
                        ? null
                        : () => _uploadImage(widget.category!.id),
                    child: Text(isUploadingImage ? 'Subiendo...' : 'Subir'),
                  ),
                if (widget.category != null &&
                    (imageCategory?.imagePath ?? widget.category?.imagePath) != null)
                  TextButton.icon(
                    onPressed: isUploadingImage ? null : () => _deleteImage(widget.category!.id),
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Eliminar imagen'),
                  ),
              ],
            ),
            if (widget.category == null)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('La imagen se subirá después de crear la categoría.'),
              ),
          ],
        ),
      ),
      actions: [
        if (widget.category != null)
          TextButton(
            onPressed: () async {
              final shouldDelete = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Eliminar categoría'),
                      content: const Text('¿Seguro que deseas eliminar esta categoría?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
                        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Eliminar')),
                      ],
                    ),
                  ) ??
                  false;
              if (!shouldDelete) return;
              try {
                await ApiService().deleteCategory(widget.category!.id);
                if (context.mounted) {
                  Navigator.pop(context);
                }
              } catch (err) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                  );
                }
              }
            },
            child: const Text('Eliminar'),
          ),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () async {
            final service = ApiService();
            if (widget.category == null) {
              final created = await service.createCategory(
                name: nameController.text,
                colorHex: colorHex ?? '#0EA5E9',
              );
              Category updated = created;
              if (selectedImage != null) {
                try {
                  updated = await service.uploadCategoryImage(
                    id: created.id,
                    bytes: selectedImage!.bytes,
                    filename: selectedImage!.filename,
                    mimeType: selectedImage!.mimeType,
                  );
                } catch (err) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                    );
                  }
                }
              }
              if (context.mounted) {
                Navigator.pop(context, updated);
              }
            } else {
              final updated = await service.updateCategory(
                widget.category!.id,
                name: nameController.text,
                colorHex: colorHex ?? '#0EA5E9',
              );
              Category result = updated;
              if (selectedImage != null) {
                try {
                  result = await service.uploadCategoryImage(
                    id: widget.category!.id,
                    bytes: selectedImage!.bytes,
                    filename: selectedImage!.filename,
                    mimeType: selectedImage!.mimeType,
                  );
                } catch (err) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                    );
                  }
                }
              }
              if (context.mounted) {
                Navigator.pop(context, result);
              }
            }
          },
          child: Text(widget.category == null ? 'Crear' : 'Guardar'),
        ),
      ],
    );
  }
}

class ProductDialog extends StatefulWidget {
  const ProductDialog({super.key, this.product});

  final Product? product;

  @override
  State<ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<ProductDialog> {
  final nameController = TextEditingController();
  final priceController = TextEditingController();
  String? categoryId;
  String? colorHex;
  _SelectedImage? selectedImage;
  bool isUploadingImage = false;
  Product? imageProduct;

  @override
  void initState() {
    super.initState();
    nameController.text = widget.product?.name ?? '';
    priceController.text = widget.product?.price.toStringAsFixed(2) ?? '';
    categoryId = widget.product?.categoryId;
    colorHex = widget.product?.colorHex;
    imageProduct = widget.product;
  }

  Future<void> _pickImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) {
      return;
    }
    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo leer el archivo seleccionado.')),
        );
      }
      return;
    }
    if (bytes.length > _maxImageBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('La imagen supera el tamaño máximo permitido (3MB).')),
        );
      }
      return;
    }
    final mimeType = _mimeTypeFromFilename(file.name);
    if (mimeType == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Formato de imagen no soportado.')),
        );
      }
      return;
    }
    setState(() {
      selectedImage = _SelectedImage(bytes: bytes, filename: file.name, mimeType: mimeType);
    });
  }

  Future<void> _uploadImage(String productId) async {
    final image = selectedImage;
    if (image == null) return;
    setState(() => isUploadingImage = true);
    try {
      final updated = await ApiService().uploadProductImage(
        id: productId,
        bytes: image.bytes,
        filename: image.filename,
        mimeType: image.mimeType,
      );
      if (mounted) {
        setState(() {
          imageProduct = updated;
          selectedImage = null;
        });
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isUploadingImage = false);
      }
    }
  }

  Future<void> _deleteImage(String productId) async {
    setState(() => isUploadingImage = true);
    try {
      final updated = await ApiService().deleteProductImage(productId);
      if (mounted) {
        setState(() {
          imageProduct = updated;
          selectedImage = null;
        });
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isUploadingImage = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.product == null ? 'Nuevo producto' : 'Editar producto'),
      content: FutureBuilder<List<Category>>(
        future: ApiService().getCategoriesAll(),
        builder: (context, snapshot) {
          final categories = snapshot.data ?? [];
          categoryId ??= categories.isNotEmpty ? categories.first.id : null;
          return SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                Focus(
                  onKeyEvent: (node, event) =>
                      _handleNumpadInput(priceController, event, allowDecimal: true),
                  child: TextField(
                    controller: priceController,
                    decoration: const InputDecoration(labelText: 'Precio'),
                  ),
                ),
                DropdownButton<String>(
                  value: categoryId,
                  items: categories
                      .map((category) => DropdownMenuItem(value: category.id, child: Text(category.name)))
                      .toList(),
                  onChanged: (value) => setState(() => categoryId = value),
                ),
                const SizedBox(height: 12),
                ColorPickerField(
                  label: 'Color (opcional)',
                  value: colorHex,
                  allowClear: true,
                  onChanged: (value) => setState(() => colorHex = value),
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Imagen', style: Theme.of(context).textTheme.titleSmall),
                ),
                const SizedBox(height: 8),
                Builder(
                  builder: (context) {
                    final imageUrl = resolveImageUrl(
                      imageProduct?.imagePath ?? widget.product?.imagePath,
                      imageProduct?.imageUpdatedAt ?? widget.product?.imageUpdatedAt,
                    );
                    Widget preview;
                    if (selectedImage != null) {
                      preview = Image.memory(
                        selectedImage!.bytes,
                        width: 160,
                        height: 160,
                        fit: BoxFit.cover,
                      );
                    } else if (imageUrl != null) {
                      preview = Image.network(
                        imageUrl,
                        width: 160,
                        height: 160,
                        fit: BoxFit.cover,
                      );
                    } else {
                      preview = Container(
                        width: 160,
                        height: 160,
                        color: Theme.of(context).colorScheme.surfaceVariant,
                        child: const Icon(Icons.image, size: 48),
                      );
                    }
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: preview,
                    );
                  },
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: isUploadingImage ? null : _pickImage,
                      icon: const Icon(Icons.upload_file),
                      label: const Text('Elegir archivo'),
                    ),
                    if (widget.product != null)
                      FilledButton(
                        onPressed: isUploadingImage || selectedImage == null
                            ? null
                            : () => _uploadImage(widget.product!.id),
                        child: Text(isUploadingImage ? 'Subiendo...' : 'Subir'),
                      ),
                    if (widget.product != null &&
                        (imageProduct?.imagePath ?? widget.product?.imagePath) != null)
                      TextButton.icon(
                        onPressed: isUploadingImage ? null : () => _deleteImage(widget.product!.id),
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Eliminar imagen'),
                      ),
                  ],
                ),
                if (widget.product == null)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('La imagen se subirá después de crear el producto.'),
                  ),
              ],
            ),
          );
        },
      ),
      actions: [
        if (widget.product != null)
          TextButton(
            onPressed: () async {
              final shouldDelete = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Eliminar producto'),
                      content: const Text('¿Seguro que deseas eliminar este producto?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
                        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Eliminar')),
                      ],
                    ),
                  ) ??
                  false;
              if (!shouldDelete) return;
              try {
                await ApiService().deleteProduct(widget.product!.id);
                if (context.mounted) {
                  Navigator.pop(context);
                }
              } catch (err) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                  );
                }
              }
            },
            child: const Text('Eliminar'),
          ),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () async {
            if (categoryId == null) return;
            final service = ApiService();
            if (widget.product == null) {
              final created = await service.createProduct(
                name: nameController.text,
                price: double.tryParse(priceController.text) ?? 0,
                categoryId: categoryId!,
                colorHex: colorHex,
              );
              Product result = created;
              if (selectedImage != null) {
                try {
                  result = await service.uploadProductImage(
                    id: created.id,
                    bytes: selectedImage!.bytes,
                    filename: selectedImage!.filename,
                    mimeType: selectedImage!.mimeType,
                  );
                } catch (err) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                    );
                  }
                }
              }
              if (context.mounted) {
                Navigator.pop(context, result);
              }
            } else {
              final updated = await service.updateProduct(
                widget.product!.id,
                name: nameController.text,
                price: double.tryParse(priceController.text) ?? 0,
                categoryId: categoryId!,
                colorHex: colorHex,
              );
              Product result = updated;
              if (selectedImage != null) {
                try {
                  result = await service.uploadProductImage(
                    id: widget.product!.id,
                    bytes: selectedImage!.bytes,
                    filename: selectedImage!.filename,
                    mimeType: selectedImage!.mimeType,
                  );
                } catch (err) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(err.toString().replaceFirst('Exception: ', ''))),
                    );
                  }
                }
              }
              if (context.mounted) {
                Navigator.pop(context, result);
              }
            }
          },
          child: Text(widget.product == null ? 'Crear' : 'Guardar'),
        ),
      ],
    );
  }
}

class AuthTokenStore {
  static const _tokenKey = 'accessToken';

  static Future<String?> load() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> save(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }
}

class ApiClient extends http.BaseClient {
  ApiClient({required this.tokenProvider, required this.onUnauthorized}) : _inner = http.Client();

  static ApiClient? _instance;

  final String? Function() tokenProvider;
  final Future<void> Function()? onUnauthorized;
  final http.Client _inner;

  static void initialize({
    required String? Function() tokenProvider,
    required Future<void> Function() onUnauthorized,
  }) {
    _instance = ApiClient(tokenProvider: tokenProvider, onUnauthorized: onUnauthorized);
  }

  static ApiClient get instance {
    final instance = _instance;
    if (instance == null) {
      throw StateError('ApiClient must be initialized before use.');
    }
    return instance;
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (request is! http.MultipartRequest &&
        request.method != 'GET' &&
        request.method != 'HEAD' &&
        !request.headers.containsKey('Content-Type')) {
      request.headers['Content-Type'] = 'application/json';
    }
    final token = tokenProvider();
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    final response = await _inner.send(request);
    if (response.statusCode == 401 && token != null && token.isNotEmpty && onUnauthorized != null) {
      await onUnauthorized!();
    }
    return response;
  }
}

class LoginException implements Exception {
  LoginException({required this.statusCode, this.backendMessage});

  final int? statusCode;
  final String? backendMessage;

  @override
  String toString() => 'LoginException(statusCode: $statusCode, message: $backendMessage)';
}

class ApiService {
  ApiService({ApiClient? client}) : apiClient = client ?? ApiClient.instance;

  final ApiClient apiClient;

  Future<String> login(String username, String password) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/auth/login');
    debugPrint('Login request: $uri');
    final response = await apiClient.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    debugPrint('Login response status: ${response.statusCode}');
    if (response.statusCode != 201 && response.statusCode != 200) {
      throw LoginException(
        statusCode: response.statusCode,
        backendMessage: _parseErrorMessage(response, fallback: ''),
      );
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['accessToken'] as String;
  }

  Future<void> logout() async {
    await apiClient.post(Uri.parse('${AppConfig.apiBaseUrl}/auth/logout'));
  }

  Future<Setting> getSettings() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/settings'));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Setting.fromJson(data);
  }

  Future<Setting> updateSettings({
    required String storeName,
    required String accentColor,
  }) async {
    final response = await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/settings'),
      body: jsonEncode({
        'storeName': storeName,
        'accentColor': accentColor,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Setting.fromJson(data);
  }

  Future<Setting> uploadSettingAsset({
    required String type,
    required Uint8List bytes,
    required String filename,
    required String mimeType,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/settings/$type');
    final request = http.MultipartRequest('POST', uri);
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
      ),
    );
    final response = await http.Response.fromStream(await apiClient.send(request));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Setting.fromJson(data);
  }

  Future<List<Category>> getCategories() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/categories'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Category.fromJson(item)).toList();
  }

  Future<List<Category>> getCategoriesAll() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/categories/all'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Category.fromJson(item)).toList();
  }

  Future<Category> createCategory({
    required String name,
    required String colorHex,
  }) async {
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/categories'),
      body: jsonEncode({
        'name': name,
        'colorHex': colorHex,
        'active': true,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<Category> updateCategory(
    String id, {
    String? name,
    String? colorHex,
    bool? active,
  }) async {
    final payload = <String, dynamic>{};
    if (name != null) payload['name'] = name;
    if (colorHex != null) payload['colorHex'] = colorHex;
    if (active != null) payload['active'] = active;
    if (kDebugMode) {
      debugPrint('PATCH /categories/$id payload: ${jsonEncode(payload)}');
    }
    final response = await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/categories/$id'),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<Category> uploadCategoryImage({
    required String id,
    required Uint8List bytes,
    required String filename,
    required String mimeType,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/categories/$id/image');
    final request = http.MultipartRequest('POST', uri);
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
        contentType: MediaType.parse(mimeType),
      ),
    );
    final response = await http.Response.fromStream(await apiClient.send(request));
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo subir la imagen'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<Category> deleteCategoryImage(String id) async {
    final response = await apiClient.delete(Uri.parse('${AppConfig.apiBaseUrl}/categories/$id/image'));
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo eliminar la imagen'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<Category> updateCategoryDetails({
    required String id,
    required String name,
    required String colorHex,
  }) async {
    final payload = {
      'name': name,
      'colorHex': colorHex,
    };
    if (kDebugMode) {
      debugPrint('PATCH /categories/$id payload: ${jsonEncode(payload)}');
    }
    final response = await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/categories/$id'),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<List<Product>> getProducts(String categoryId) async {
    final response = await apiClient.get(
      Uri.parse('${AppConfig.apiBaseUrl}/categories/$categoryId/products?includeInactive=false'),
    );
    final data = jsonDecode(response.body) as List<dynamic>;
    final products = data.map((item) => Product.fromJson(item)).toList();
    if (kDebugMode) {
      final categoryIds = products.map((product) => product.categoryId).toSet().join(', ');
      debugPrint(
        'GET /categories/$categoryId/products -> ${products.length} products (categoryIds: $categoryIds)',
      );
    }
    return products;
  }

  Future<List<Product>> getProductsAll() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/products/all'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Product.fromJson(item)).toList();
  }

  Future<Product> createProduct({
    required String name,
    required double price,
    required String categoryId,
    String? colorHex,
  }) async {
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/products'),
      body: jsonEncode({
        'name': name,
        'price': price,
        'categoryId': categoryId,
        'colorHex': colorHex,
        'active': true,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Product.fromJson(data);
  }

  Future<Product> updateProduct(
    String id, {
    String? name,
    double? price,
    String? categoryId,
    String? colorHex,
    bool? active,
  }) async {
    final payload = <String, dynamic>{};
    if (name != null) payload['name'] = name;
    if (price != null) payload['price'] = price;
    if (categoryId != null) payload['categoryId'] = categoryId;
    if (colorHex != null) payload['colorHex'] = colorHex;
    if (active != null) payload['active'] = active;
    final response = await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/products/$id'),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Product.fromJson(data);
  }

  Future<Product> uploadProductImage({
    required String id,
    required Uint8List bytes,
    required String filename,
    required String mimeType,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/products/$id/image');
    final request = http.MultipartRequest('POST', uri);
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
        contentType: MediaType.parse(mimeType),
      ),
    );
    final response = await http.Response.fromStream(await apiClient.send(request));
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo subir la imagen'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Product.fromJson(data);
  }

  Future<Product> deleteProductImage(String id) async {
    final response = await apiClient.delete(Uri.parse('${AppConfig.apiBaseUrl}/products/$id/image'));
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo eliminar la imagen'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Product.fromJson(data);
  }

  Future<void> deleteCategory(String id) async {
    final response = await apiClient.delete(Uri.parse('${AppConfig.apiBaseUrl}/categories/$id'));
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['message'] ?? 'No se pudo eliminar la categoría');
    }
    if (response.statusCode >= 400) {
      throw Exception('No se pudo eliminar la categoría');
    }
  }

  Future<void> deleteProduct(String id) async {
    final response = await apiClient.delete(
      Uri.parse('${AppConfig.apiBaseUrl}/products/$id'),
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['message'] ?? 'No se pudo eliminar el producto');
    }
    if (response.statusCode >= 400) {
      throw Exception('No se pudo eliminar el producto');
    }
  }

  Future<Sale> createSale(List<CartItem> items) async {
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/sales'),
      body: jsonEncode({
        'items': items.map((item) => {'productId': item.product.id, 'quantity': item.quantity}).toList(),
      }),
    );
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo crear la venta'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Sale.fromJson(data);
  }

  Future<void> startMercadoPagoPayment(String saleId) async {
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/sales/$saleId/payments/mercadopago-qr'),
    );
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo iniciar el cobro'));
    }
  }

  Future<void> cancelMercadoPagoPayment(String saleId) async {
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/sales/$saleId/payments/mercadopago-qr/cancel'),
    );
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo cancelar el cobro'));
    }
  }

  Future<Sale> getSale(String saleId) async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/sales/$saleId'));
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo obtener la venta'));
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Sale.fromJson(data);
  }

  Future<List<User>> getUsers() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/users'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => User.fromJson(item)).toList();
  }

  Future<void> createUser({
    required String name,
    String? email,
    required String password,
    required String role,
    String? externalPosId,
    String? externalStoreId,
  }) async {
    final trimmedEmail = email?.trim();
    final payload = <String, dynamic>{
      'name': name,
      'password': password,
      'role': role,
    };
    if (trimmedEmail != null && trimmedEmail.isNotEmpty) {
      payload['email'] = trimmedEmail;
    }
    final trimmedPos = externalPosId?.trim();
    if (trimmedPos != null && trimmedPos.isNotEmpty) {
      payload['externalPosId'] = trimmedPos;
    }
    final trimmedStore = externalStoreId?.trim();
    if (trimmedStore != null && trimmedStore.isNotEmpty) {
      payload['externalStoreId'] = trimmedStore;
    }
    final response = await apiClient.post(
      Uri.parse('${AppConfig.apiBaseUrl}/users'),
      body: jsonEncode(payload),
    );
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo crear el usuario'));
    }
  }

  Future<void> updateUser(String id, {bool? active}) async {
    final payload = <String, dynamic>{};
    if (active != null) {
      payload['active'] = active;
    }
    await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/users/$id'),
      body: jsonEncode(payload),
    );
  }

  Future<void> updateUserPassword(String id, String password) async {
    final response = await apiClient.patch(
      Uri.parse('${AppConfig.apiBaseUrl}/users/$id'),
      body: jsonEncode({'password': password}),
    );
    if (response.statusCode >= 400) {
      throw Exception(_parseErrorMessage(response, fallback: 'No se pudo actualizar la contraseña'));
    }
  }

  Future<List<SummaryRow>> summaryByProduct({DateTime? from, DateTime? to}) async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/reports/products${_dateQuery(from, to)}'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => SummaryRow.fromJson(item)).toList();
  }

  Future<List<SummaryRow>> summaryByCategory({DateTime? from, DateTime? to}) async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/reports/categories${_dateQuery(from, to)}'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => SummaryRow.fromJson(item)).toList();
  }

  Future<List<int>> exportReport({DateTime? from, DateTime? to}) async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/reports/export${_dateQuery(from, to)}'));
    return response.bodyBytes;
  }

  Future<List<TotalRow>> totalsByDay() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/stats/totals-by-day'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => TotalRow.fromJson(item)).toList();
  }

  Future<List<TotalRow>> totalsByMonth() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/stats/totals-by-month'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => TotalRow.fromJson(item)).toList();
  }

  Future<List<AverageRow>> averageByCategory() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/stats/average-daily-by-category'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => AverageRow.fromJson(item)).toList();
  }

  Future<List<AverageRow>> averageByProduct() async {
    final response = await apiClient.get(Uri.parse('${AppConfig.apiBaseUrl}/stats/average-daily-by-product'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => AverageRow.fromJson(item)).toList();
  }

  String _dateQuery(DateTime? from, DateTime? to) {
    final params = <String>[];
    if (from != null) params.add('from=${from.toIso8601String()}');
    if (to != null) params.add('to=${to.toIso8601String()}');
    if (params.isEmpty) return '';
    return '?${params.join('&')}';
  }

  String _parseErrorMessage(http.Response response, {required String fallback}) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is List) {
          return message.map((item) => item.toString()).join('\n');
        }
        if (message is String && message.isNotEmpty) {
          return message;
        }
      }
    } catch (_) {
      // Ignore parsing errors and fallback.
    }
    return fallback;
  }
}

class Setting {
  Setting({required this.storeName, this.logoUrl, this.faviconUrl, this.accentColor});

  final String storeName;
  final String? logoUrl;
  final String? faviconUrl;
  final String? accentColor;

  factory Setting.fromJson(Map<String, dynamic> json) => Setting(
        storeName: json['storeName'] as String,
        logoUrl: json['logoUrl'] as String?,
        faviconUrl: json['faviconUrl'] as String?,
        accentColor: json['accentColor'] as String?,
      );
}

enum PaymentMethodType {
  cash('Efectivo', Icons.payments),
  mercadoPagoQr('Mercado Pago (QR)', Icons.qr_code_2);

  const PaymentMethodType(this.label, this.icon);

  final String label;
  final IconData icon;
}

class PaymentMethod {
  PaymentMethod({
    required this.id,
    required this.name,
    required this.type,
  });

  factory PaymentMethod.cash() => PaymentMethod(
        id: 'cash',
        name: 'Efectivo',
        type: PaymentMethodType.cash,
      );

  factory PaymentMethod.mercadoPagoQr() => PaymentMethod(
        id: 'mp_qr',
        name: 'Mercado Pago (QR)',
        type: PaymentMethodType.mercadoPagoQr,
      );

  final String id;
  final String name;
  final PaymentMethodType type;
}

class Category {
  Category({
    required this.id,
    required this.name,
    required this.colorHex,
    required this.active,
    this.imagePath,
    this.imageUpdatedAt,
  });

  final String id;
  final String name;
  final String colorHex;
  final bool active;
  final String? imagePath;
  final DateTime? imageUpdatedAt;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        colorHex: json['colorHex'] as String? ?? '#0EA5E9',
        active: json['active'] as bool? ?? true,
        imagePath: json['imagePath'] as String?,
        imageUpdatedAt:
            json['imageUpdatedAt'] != null ? DateTime.parse(json['imageUpdatedAt'] as String) : null,
      );
}

class Product {
  Product({
    required this.id,
    required this.name,
    required this.price,
    required this.categoryId,
    required this.active,
    this.colorHex,
    this.categoryName,
    this.categoryColorHex,
    this.imagePath,
    this.imageUpdatedAt,
  });

  final String id;
  final String name;
  final double price;
  final String categoryId;
  final bool active;
  final String? colorHex;
  final String? categoryName;
  final String? categoryColorHex;
  final String? imagePath;
  final DateTime? imageUpdatedAt;

  static double _priceFromJson(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.parse(value);
    throw FormatException('Unsupported price value: $value');
  }

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        price: _priceFromJson(json['price']),
        categoryId: json['categoryId'] as String,
        active: json['active'] as bool? ?? true,
        colorHex: json['colorHex'] as String?,
        categoryName: json['category'] is Map<String, dynamic>
            ? (json['category'] as Map<String, dynamic>)['name'] as String?
            : null,
        categoryColorHex: json['category'] is Map<String, dynamic>
            ? (json['category'] as Map<String, dynamic>)['colorHex'] as String?
            : null,
        imagePath: json['imagePath'] as String?,
        imageUpdatedAt:
            json['imageUpdatedAt'] != null ? DateTime.parse(json['imageUpdatedAt'] as String) : null,
      );
}

class ProductCacheEntry {
  ProductCacheEntry({required this.products, required this.fetchedAt});

  final List<Product> products;
  final DateTime fetchedAt;

  bool isFresh(Duration ttl) => DateTime.now().difference(fetchedAt) < ttl;
}

class ProductCache {
  ProductCache({Duration ttl = const Duration(seconds: 60)}) : _ttl = ttl;

  static final ProductCache instance = ProductCache();

  final Map<String, ProductCacheEntry> _entries = {};
  Duration _ttl;

  Duration get ttl => _ttl;
  set ttl(Duration value) => _ttl = value;

  List<Product>? getFresh(String key) {
    final entry = _entries[key];
    if (entry == null || !entry.isFresh(_ttl)) {
      return null;
    }
    return entry.products;
  }

  void set(String key, List<Product> products) {
    _entries[key] = ProductCacheEntry(
      products: List<Product>.unmodifiable(products),
      fetchedAt: DateTime.now(),
    );
  }
}

class CartItem {
  CartItem({required this.product, required this.quantity});

  final Product product;
  final int quantity;

  double get total => product.price * quantity;

  CartItem copyWith({int? quantity}) => CartItem(product: product, quantity: quantity ?? this.quantity);
}

class SummaryRow {
  SummaryRow({required this.id, required this.name, required this.quantity, required this.total});

  final String id;
  final String name;
  final int quantity;
  final double total;

  factory SummaryRow.fromJson(Map<String, dynamic> json) => SummaryRow(
        id: json['id'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        total: (json['total'] as num).toDouble(),
      );
}

class TotalRow {
  TotalRow({required this.label, required this.total});

  final String label;
  final double total;

  factory TotalRow.fromJson(Map<String, dynamic> json) => TotalRow(
        label: json['label'] as String,
        total: (json['total'] as num).toDouble(),
      );
}

class AverageRow {
  AverageRow({required this.id, required this.name, required this.averageDaily});

  final String id;
  final String name;
  final double averageDaily;

  factory AverageRow.fromJson(Map<String, dynamic> json) => AverageRow(
        id: json['id'] as String,
        name: json['name'] as String,
        averageDaily: (json['averageDaily'] as num).toDouble(),
      );
}

class Sale {
  Sale({required this.id, required this.total, required this.status});

  final String id;
  final double total;
  final String status;

  factory Sale.fromJson(Map<String, dynamic> json) => Sale(
        id: json['id'] as String,
        total: json['total'] is num ? (json['total'] as num).toDouble() : double.parse(json['total'].toString()),
        status: json['status'] as String? ?? 'OPEN',
      );
}

class User {
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.active,
    this.externalPosId,
    this.externalStoreId,
  });

  final String id;
  final String name;
  final String? email;
  final String role;
  final bool active;
  final String? externalPosId;
  final String? externalStoreId;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String?,
        role: json['role'] as String,
        active: json['active'] as bool? ?? true,
        externalPosId: json['externalPosId'] as String?,
        externalStoreId: json['externalStoreId'] as String?,
      );
}

int hexToColor(String hex) {
  final buffer = StringBuffer();
  if (hex.length == 6 || hex.length == 7) buffer.write('ff');
  buffer.write(hex.replaceFirst('#', ''));
  return int.parse(buffer.toString(), radix: 16);
}

Color? colorFromHex(String? hex) {
  if (hex == null || hex.isEmpty) {
    return null;
  }
  try {
    return Color(hexToColor(hex));
  } catch (_) {
    return null;
  }
}

Color foregroundColorFor(Color background) {
  final brightness = ThemeData.estimateBrightnessForColor(background);
  return brightness == Brightness.dark ? Colors.white : Colors.black;
}

String resolveApiUrl(String url) {
  if (url.startsWith('http')) {
    return url;
  }
  if (url.startsWith('/')) {
    return '${AppConfig.apiBaseUrl}$url';
  }
  return '${AppConfig.apiBaseUrl}/$url';
}

String? resolveImageUrl(String? url, DateTime? updatedAt) {
  if (url == null || url.isEmpty) {
    return null;
  }
  final resolved = resolveApiUrl(url);
  if (updatedAt == null) {
    return resolved;
  }
  return '$resolved?v=${updatedAt.millisecondsSinceEpoch}';
}

String _initialFromName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) {
    return '';
  }
  final rune = trimmed.runes.isNotEmpty ? trimmed.runes.first : null;
  if (rune == null) {
    return '';
  }
  return String.fromCharCode(rune).toUpperCase();
}

Widget _buildFallbackContent({
  required String name,
  required double size,
  required Color foregroundColor,
}) {
  final initial = _initialFromName(name);
  if (initial.isEmpty) {
    return Icon(Icons.image_not_supported, size: size * 0.45, color: foregroundColor);
  }
  return Text(
    initial,
    style: TextStyle(
      fontSize: size * 0.45,
      fontWeight: FontWeight.w700,
      color: foregroundColor,
    ),
  );
}

Widget _buildFallbackContainer({
  required String name,
  required double width,
  required double height,
  required Color backgroundColor,
  required Color foregroundColor,
  BorderRadius borderRadius = const BorderRadius.all(Radius.circular(12)),
  BoxShape shape = BoxShape.rectangle,
}) {
  final size = width < height ? width : height;
  return Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: backgroundColor,
      shape: shape,
      borderRadius: shape == BoxShape.rectangle ? borderRadius : null,
    ),
    alignment: Alignment.center,
    child: _buildFallbackContent(
      name: name,
      size: size,
      foregroundColor: foregroundColor,
    ),
  );
}

Widget buildImageOrFallback({
  required String? imageUrl,
  required String name,
  required Color backgroundColor,
  required Color foregroundColor,
  required double size,
  double? cacheSize,
  BorderRadius borderRadius = const BorderRadius.all(Radius.circular(12)),
  BoxShape shape = BoxShape.rectangle,
}) {
  final placeholder = _buildFallbackContainer(
    name: name,
    width: size,
    height: size,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    borderRadius: borderRadius,
    shape: shape,
  );
  if (imageUrl == null || imageUrl.isEmpty) {
    return placeholder;
  }
  final image = Image.network(
    imageUrl,
    width: size,
    height: size,
    fit: BoxFit.cover,
    cacheWidth: cacheSize?.round(),
    cacheHeight: cacheSize?.round(),
    loadingBuilder: (context, child, loadingProgress) =>
        loadingProgress == null ? child : placeholder,
    errorBuilder: (context, error, stackTrace) => placeholder,
  );
  if (shape == BoxShape.circle) {
    return ClipOval(child: image);
  }
  return ClipRRect(borderRadius: borderRadius, child: image);
}

Widget buildFillImageOrFallback({
  required String? imageUrl,
  required String name,
  required Color backgroundColor,
  required Color foregroundColor,
  double? cacheSize,
  BorderRadius borderRadius = const BorderRadius.all(Radius.circular(12)),
}) {
  return LayoutBuilder(
    builder: (context, constraints) {
      final width = constraints.maxWidth;
      final height = constraints.maxHeight;
      final placeholder = _buildFallbackContainer(
        name: name,
        width: width,
        height: height,
        backgroundColor: backgroundColor,
        foregroundColor: foregroundColor,
        borderRadius: borderRadius,
      );
      if (imageUrl == null || imageUrl.isEmpty) {
        return placeholder;
      }
      return ClipRRect(
        borderRadius: borderRadius,
        child: Image.network(
          imageUrl,
          width: width,
          height: height,
          fit: BoxFit.cover,
          cacheWidth: cacheSize?.round(),
          cacheHeight: cacheSize?.round(),
          loadingBuilder: (context, child, loadingProgress) =>
              loadingProgress == null ? child : placeholder,
          errorBuilder: (context, error, stackTrace) => placeholder,
        ),
      );
    },
  );
}

Widget buildCircleImageOrFallback({
  required String? imageUrl,
  required String name,
  required Color backgroundColor,
  required Color foregroundColor,
  double size = 40,
  double? cacheSize,
}) {
  return buildImageOrFallback(
    imageUrl: imageUrl,
    name: name,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    size: size,
    cacheSize: cacheSize ?? size,
    shape: BoxShape.circle,
  );
}

void updateFavicon(String url) {
  final link = html.document.querySelector('link[rel=\"icon\"]') as html.LinkElement?;
  if (link == null) {
    final newLink = html.LinkElement()
      ..rel = 'icon'
      ..href = url;
    html.document.head?.append(newLink);
    return;
  }
  link.href = url;
}

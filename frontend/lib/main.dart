import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import 'material_symbol_catalog.dart';
import 'pickers.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

void main() {
  runApp(const MiBpsApp());
}

class MiBpsApp extends StatefulWidget {
  const MiBpsApp({super.key});

  @override
  State<MiBpsApp> createState() => _MiBpsAppState();
}

class _MiBpsAppState extends State<MiBpsApp> {
  final authState = ValueNotifier<String?>(null);
  final settings = ValueNotifier<Setting?>(null);

  @override
  void initState() {
    super.initState();
    ApiService(tokenProvider: () => authState.value).getSettings().then((value) {
      settings.value = value;
    });
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
                    authState.value = newToken;
                    settings.value = await ApiService(tokenProvider: () => authState.value)
                        .getSettings();
                  },
                );
              }
              return AuthScope(
                token: token,
                child: HomeShell(
                  authState: authState,
                  settingNotifier: settings,
                ),
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
    final destinations = [
      _Destination('POS', Icons.storefront, const PosScreen()),
      _Destination('Admin', Icons.admin_panel_settings, const AdminScreen()),
      _Destination('Reportes', Icons.receipt_long, const ReportsScreen()),
      _Destination('Estadísticas', Icons.bar_chart, const StatsScreen()),
      _Destination('Personalización', Icons.palette, SettingsScreen(settingNotifier: widget.settingNotifier)),
    ];

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
                onPressed: () => widget.authState.value = null,
                icon: const Icon(Icons.logout),
                label: const Text('Salir'),
              ),
            ],
          ),
          body: Row(
            children: [
              if (isWide)
                NavigationRail(
                  selectedIndex: selectedIndex,
                  onDestinationSelected: (value) => setState(() => selectedIndex = value),
                  destinations: destinations
                      .map((item) => NavigationRailDestination(
                            icon: Icon(item.icon),
                            label: Text(item.label),
                          ))
                      .toList(),
                ),
              Expanded(child: destinations[selectedIndex].screen),
            ],
          ),
          bottomNavigationBar: isWide
              ? null
              : NavigationBar(
                  selectedIndex: selectedIndex,
                  onDestinationSelected: (value) => setState(() => selectedIndex = value),
                  destinations: destinations
                      .map((item) => NavigationDestination(icon: Icon(item.icon), label: item.label))
                      .toList(),
                ),
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
  final emailController = TextEditingController(text: 'admin@mibps.local');
  final passwordController = TextEditingController(text: 'Admin123!');
  bool loading = false;
  String? error;

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
                    controller: emailController,
                    decoration: const InputDecoration(labelText: 'Email'),
                    autofillHints: const [],
                    enableSuggestions: false,
                    autocorrect: false,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passwordController,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                    obscureText: true,
                    autofillHints: const [],
                    enableSuggestions: false,
                    autocorrect: false,
                    textInputAction: TextInputAction.done,
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
                              final token = await ApiService(tokenProvider: () => null)
                                  .login(emailController.text, passwordController.text);
                              widget.onLoggedIn(token);
                            } catch (e) {
                              setState(() => error = 'Credenciales inválidas');
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
  Category? selectedCategory;
  String _quantityBuffer = '';
  String? _selectedItemId;

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

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      focusNode: _keyboardFocusNode,
      onKeyEvent: _handleKeyEvent,
      child: FutureBuilder<List<Category>>(
        future: ApiService(tokenProvider: () => AuthScope.of(context)).getCategories(),
        builder: (context, snapshot) {
          final categories = snapshot.data ?? [];
          return Row(
            children: [
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text('Categorías', style: Theme.of(context).textTheme.titleLarge),
                    ),
                    Expanded(
                      child: GridView.builder(
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
                          final background =
                              colorFromHex(category.colorHex) ?? Theme.of(context).colorScheme.primaryContainer;
                          final foreground = foregroundColorFor(background);
                          return GestureDetector(
                            onTap: () => setState(() => selectedCategory = category),
                            child: Card(
                              clipBehavior: Clip.antiAlias,
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(color: background),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      symbolFromName(category.iconName),
                                      size: 48,
                                      color: foreground,
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      category.name,
                                      style: TextStyle(fontSize: 16, color: foreground),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    if (selectedCategory != null)
                      Expanded(
                        child: FutureBuilder<List<Product>>(
                          future: ApiService(tokenProvider: () => AuthScope.of(context))
                              .getProducts(selectedCategory!.id),
                          builder: (context, productsSnapshot) {
                            final products = productsSnapshot.data ?? [];
                            return GridView.builder(
                              padding: const EdgeInsets.all(16),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 1.1,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                              ),
                              itemCount: products.length,
                              itemBuilder: (context, index) {
                                final product = products[index];
                                final background = colorFromHex(product.colorHex) ??
                                    colorFromHex(selectedCategory?.colorHex) ??
                                    Theme.of(context).colorScheme.primaryContainer;
                                final foreground = foregroundColorFor(background);
                                final iconName = product.iconName ?? selectedCategory?.iconName;
                                return FilledButton(
                                  style: FilledButton.styleFrom(
                                    padding: const EdgeInsets.all(8),
                                    backgroundColor: background,
                                    foregroundColor: foreground,
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
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(symbolFromName(iconName), size: 40, color: foreground),
                                      const SizedBox(height: 8),
                                      Text(product.name, textAlign: TextAlign.center, style: TextStyle(color: foreground)),
                                      Text('\$${product.price.toStringAsFixed(2)}', style: TextStyle(color: foreground)),
                                    ],
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                flex: 2,
                child: Container(
                  color: Theme.of(context).colorScheme.surfaceVariant,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text('Carrito', style: Theme.of(context).textTheme.titleLarge),
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
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            Text(
                              'Total: \$${cartTotal.toStringAsFixed(2)}',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: cart.isEmpty ? null : () => _submitSale(context),
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                child: Text('Cobrar / Confirmar venta'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
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
    await _submitSale(context);
  }

  Future<void> _submitSale(BuildContext context) async {
    await ApiService(tokenProvider: () => AuthScope.of(context)).createSale(cart.values.toList());
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
      future: ApiService(tokenProvider: () => AuthScope.of(context)).getUsers(),
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
                  subtitle: Text('${user.email} · ${user.role}'),
                  trailing: Switch(
                    value: user.active,
                    onChanged: (value) async {
                      await ApiService(tokenProvider: () => AuthScope.of(context))
                          .updateUser(user.id, active: value);
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

class AdminCategoriesTab extends StatefulWidget {
  const AdminCategoriesTab({super.key});

  @override
  State<AdminCategoriesTab> createState() => _AdminCategoriesTabState();
}

class _AdminCategoriesTabState extends State<AdminCategoriesTab> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Category>>(
      future: ApiService(tokenProvider: () => AuthScope.of(context)).getCategoriesAll(),
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
                  leading: CircleAvatar(
                    backgroundColor: colorFromHex(category.colorHex) ?? Theme.of(context).colorScheme.primaryContainer,
                    child: Icon(
                      symbolFromName(category.iconName),
                      color: foregroundColorFor(
                        colorFromHex(category.colorHex) ?? Theme.of(context).colorScheme.primaryContainer,
                      ),
                    ),
                  ),
                  title: Text(category.name),
                  subtitle: Text('${category.imageUrl} · ${category.colorHex}'),
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
                      await ApiService(tokenProvider: () => AuthScope.of(context))
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
      future: ApiService(tokenProvider: () => AuthScope.of(context)).getProductsAll(),
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
                  leading: CircleAvatar(
                    backgroundColor: colorFromHex(product.colorHex) ??
                        colorFromHex(product.categoryColorHex) ??
                        Theme.of(context).colorScheme.primaryContainer,
                    child: Icon(
                      symbolFromName(product.iconName ?? product.categoryIconName),
                      color: foregroundColorFor(
                        colorFromHex(product.colorHex) ??
                            colorFromHex(product.categoryColorHex) ??
                            Theme.of(context).colorScheme.primaryContainer,
                      ),
                    ),
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
                      await ApiService(tokenProvider: () => AuthScope.of(context))
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
                  final bytes = await ApiService(tokenProvider: () => AuthScope.of(context)).exportReport(from: from, to: to);
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
                    future: ApiService(tokenProvider: () => AuthScope.of(context))
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
                    future: ApiService(tokenProvider: () => AuthScope.of(context))
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
            future: ApiService(tokenProvider: () => AuthScope.of(context)).totalsByDay(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return ChartCard(title: 'Ventas por día (últimos 15)', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<TotalRow>>(
            future: ApiService(tokenProvider: () => AuthScope.of(context)).totalsByMonth(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return ChartCard(title: 'Ventas por mes (últimos 6)', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<AverageRow>>(
            future: ApiService(tokenProvider: () => AuthScope.of(context)).averageByCategory(),
            builder: (context, snapshot) {
              final rows = snapshot.data ?? [];
              return AverageCard(title: 'Promedio diario por categoría', rows: rows);
            },
          ),
          const SizedBox(height: 16),
          FutureBuilder<List<AverageRow>>(
            future: ApiService(tokenProvider: () => AuthScope.of(context)).averageByProduct(),
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
            final updated = await ApiService(tokenProvider: () => AuthScope.of(context)).updateSettings(
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
      final updated = await ApiService(tokenProvider: () => AuthScope.of(context)).uploadSettingAsset(
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
  String role = 'USER';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Crear usuario'),
      content: SingleChildScrollView(
        child: Column(
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
            TextField(controller: emailController, decoration: const InputDecoration(labelText: 'Email')),
            TextField(controller: passwordController, decoration: const InputDecoration(labelText: 'Contraseña')),
            DropdownButton<String>(
              value: role,
              items: const [
                DropdownMenuItem(value: 'USER', child: Text('USER')),
                DropdownMenuItem(value: 'ADMIN', child: Text('ADMIN')),
              ],
              onChanged: (value) => setState(() => role = value ?? 'USER'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () async {
            await ApiService(tokenProvider: () => AuthScope.of(context)).createUser(
              name: nameController.text,
              email: emailController.text,
              password: passwordController.text,
              role: role,
            );
            if (context.mounted) {
              Navigator.pop(context);
            }
          },
          child: const Text('Crear'),
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
  final imageController = TextEditingController();
  String? iconName;
  String? colorHex;

  @override
  void initState() {
    super.initState();
    nameController.text = widget.category?.name ?? '';
    imageController.text = widget.category?.imageUrl ?? '';
    iconName = widget.category?.iconName ?? 'category';
    colorHex = widget.category?.colorHex ?? '#0EA5E9';
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
            TextField(controller: imageController, decoration: const InputDecoration(labelText: 'Imagen URL')),
            const SizedBox(height: 12),
            IconPickerField(
              label: 'Icono',
              value: iconName,
              onChanged: (value) => setState(() => iconName = value),
              searcher: (query) =>
                  ApiService(tokenProvider: () => AuthScope.of(context)).searchMaterialSymbols(query),
            ),
            const SizedBox(height: 12),
            ColorPickerField(
              label: 'Color',
              value: colorHex,
              onChanged: (value) => setState(() => colorHex = value),
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
                await ApiService(tokenProvider: () => AuthScope.of(context)).deleteCategory(widget.category!.id);
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
            final service = ApiService(tokenProvider: () => AuthScope.of(context));
            if (widget.category == null) {
              await service.createCategory(
                name: nameController.text,
                imageUrl: imageController.text,
                iconName: iconName ?? 'category',
                colorHex: colorHex ?? '#0EA5E9',
              );
            } else {
              await service.updateCategory(
                widget.category!.id,
                name: nameController.text,
                imageUrl: imageController.text,
                iconName: iconName ?? 'category',
                colorHex: colorHex ?? '#0EA5E9',
              );
            }
            if (context.mounted) {
              Navigator.pop(context);
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
  final imageController = TextEditingController();
  String? categoryId;
  String? iconName;
  String? colorHex;

  @override
  void initState() {
    super.initState();
    nameController.text = widget.product?.name ?? '';
    priceController.text = widget.product?.price.toStringAsFixed(2) ?? '';
    imageController.text = widget.product?.imageUrl ?? '';
    categoryId = widget.product?.categoryId;
    iconName = widget.product?.iconName;
    colorHex = widget.product?.colorHex;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.product == null ? 'Nuevo producto' : 'Editar producto'),
      content: FutureBuilder<List<Category>>(
        future: ApiService(tokenProvider: () => AuthScope.of(context)).getCategoriesAll(),
        builder: (context, snapshot) {
          final categories = snapshot.data ?? [];
          categoryId ??= categories.isNotEmpty ? categories.first.id : null;
          return SingleChildScrollView(
            child: Column(
              children: [
                TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Nombre')),
                TextField(controller: priceController, decoration: const InputDecoration(labelText: 'Precio')),
                TextField(controller: imageController, decoration: const InputDecoration(labelText: 'Imagen URL')),
                DropdownButton<String>(
                  value: categoryId,
                  items: categories
                      .map((category) => DropdownMenuItem(value: category.id, child: Text(category.name)))
                      .toList(),
                  onChanged: (value) => setState(() => categoryId = value),
                ),
                const SizedBox(height: 12),
                IconPickerField(
                  label: 'Icono (opcional)',
                  value: iconName,
                  allowClear: true,
                  onChanged: (value) => setState(() => iconName = value),
                  searcher: (query) =>
                      ApiService(tokenProvider: () => AuthScope.of(context)).searchMaterialSymbols(query),
                ),
                const SizedBox(height: 12),
                ColorPickerField(
                  label: 'Color (opcional)',
                  value: colorHex,
                  allowClear: true,
                  onChanged: (value) => setState(() => colorHex = value),
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
                await ApiService(tokenProvider: () => AuthScope.of(context)).deleteProduct(widget.product!.id);
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
            final service = ApiService(tokenProvider: () => AuthScope.of(context));
            if (widget.product == null) {
              await service.createProduct(
                name: nameController.text,
                price: double.tryParse(priceController.text) ?? 0,
                imageUrl: imageController.text,
                categoryId: categoryId!,
                iconName: iconName,
                colorHex: colorHex,
              );
            } else {
              await service.updateProduct(
                widget.product!.id,
                name: nameController.text,
                price: double.tryParse(priceController.text) ?? 0,
                imageUrl: imageController.text,
                categoryId: categoryId!,
                iconName: iconName,
                colorHex: colorHex,
              );
            }
            if (context.mounted) {
              Navigator.pop(context);
            }
          },
          child: Text(widget.product == null ? 'Crear' : 'Guardar'),
        ),
      ],
    );
  }
}

class AuthScope extends InheritedWidget {
  const AuthScope({super.key, required this.token, required super.child});

  final String token;

  static String of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AuthScope>();
    return scope?.token ?? '';
  }

  @override
  bool updateShouldNotify(AuthScope oldWidget) => token != oldWidget.token;
}

class ApiService {
  ApiService({required this.tokenProvider});

  final String? Function() tokenProvider;

  Future<String> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (response.statusCode != 201 && response.statusCode != 200) {
      throw Exception('Login failed');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['accessToken'] as String;
  }

  Future<Setting> getSettings() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/settings'));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Setting.fromJson(data);
  }

  Future<Setting> updateSettings({
    required String storeName,
    required String accentColor,
  }) async {
    final response = await http.patch(
      Uri.parse('$apiBaseUrl/settings'),
      headers: _headers(),
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
    final uri = Uri.parse('$apiBaseUrl/settings/$type');
    final request = http.MultipartRequest('POST', uri);
    request.headers.addAll(_headers(json: false));
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
      ),
    );
    final response = await http.Response.fromStream(await request.send());
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Setting.fromJson(data);
  }

  Future<List<Category>> getCategories() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/categories'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Category.fromJson(item)).toList();
  }

  Future<List<Category>> getCategoriesAll() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/categories/all'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Category.fromJson(item)).toList();
  }

  Future<Category> createCategory({
    required String name,
    required String imageUrl,
    required String iconName,
    required String colorHex,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/categories'),
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'imageUrl': imageUrl,
        'iconName': iconName,
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
    String? imageUrl,
    String? iconName,
    String? colorHex,
    bool? active,
  }) async {
    final payload = <String, dynamic>{};
    if (name != null) payload['name'] = name;
    if (imageUrl != null) payload['imageUrl'] = imageUrl;
    if (iconName != null) payload['iconName'] = iconName;
    if (colorHex != null) payload['colorHex'] = colorHex;
    if (active != null) payload['active'] = active;
    final response = await http.patch(
      Uri.parse('$apiBaseUrl/categories/$id'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Category.fromJson(data);
  }

  Future<List<Product>> getProducts(String categoryId) async {
    final response = await http.get(Uri.parse('$apiBaseUrl/products?categoryId=$categoryId'));
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Product.fromJson(item)).toList();
  }

  Future<List<Product>> getProductsAll() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/products/all'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => Product.fromJson(item)).toList();
  }

  Future<Product> createProduct({
    required String name,
    required double price,
    required String imageUrl,
    required String categoryId,
    String? iconName,
    String? colorHex,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/products'),
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'price': price,
        'imageUrl': imageUrl,
        'categoryId': categoryId,
        'iconName': iconName,
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
    String? imageUrl,
    String? categoryId,
    String? iconName,
    String? colorHex,
    bool? active,
  }) async {
    final payload = <String, dynamic>{};
    if (name != null) payload['name'] = name;
    if (price != null) payload['price'] = price;
    if (imageUrl != null) payload['imageUrl'] = imageUrl;
    if (categoryId != null) payload['categoryId'] = categoryId;
    if (iconName != null) payload['iconName'] = iconName;
    if (colorHex != null) payload['colorHex'] = colorHex;
    if (active != null) payload['active'] = active;
    final response = await http.patch(
      Uri.parse('$apiBaseUrl/products/$id'),
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return Product.fromJson(data);
  }

  Future<void> deleteCategory(String id) async {
    final response = await http.delete(
      Uri.parse('$apiBaseUrl/categories/$id'),
      headers: _headers(),
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['message'] ?? 'No se pudo eliminar la categoría');
    }
    if (response.statusCode >= 400) {
      throw Exception('No se pudo eliminar la categoría');
    }
  }

  Future<void> deleteProduct(String id) async {
    final response = await http.delete(
      Uri.parse('$apiBaseUrl/products/$id'),
      headers: _headers(),
    );
    if (response.statusCode == 409) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['message'] ?? 'No se pudo eliminar el producto');
    }
    if (response.statusCode >= 400) {
      throw Exception('No se pudo eliminar el producto');
    }
  }

  Future<List<String>> searchMaterialSymbols(String query) async {
    final uri = Uri.parse('$apiBaseUrl/icons/material-symbols?q=$query');
    final response = await http.get(uri);
    if (response.statusCode >= 400) {
      throw Exception('No se pudieron cargar los iconos');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>;
    return items.map((item) => item['iconName'] as String).toList();
  }

  Future<void> createSale(List<CartItem> items) async {
    await http.post(
      Uri.parse('$apiBaseUrl/sales'),
      headers: _headers(),
      body: jsonEncode({
        'items': items.map((item) => {'productId': item.product.id, 'quantity': item.quantity}).toList(),
      }),
    );
  }

  Future<List<User>> getUsers() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/users'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => User.fromJson(item)).toList();
  }

  Future<void> createUser({required String name, required String email, required String password, required String role}) async {
    await http.post(
      Uri.parse('$apiBaseUrl/users'),
      headers: _headers(),
      body: jsonEncode({'name': name, 'email': email, 'password': password, 'role': role}),
    );
  }

  Future<void> updateUser(String id, {bool? active}) async {
    await http.patch(
      Uri.parse('$apiBaseUrl/users/$id'),
      headers: _headers(),
      body: jsonEncode({'active': active}),
    );
  }

  Future<List<SummaryRow>> summaryByProduct({DateTime? from, DateTime? to}) async {
    final response = await http.get(Uri.parse('$apiBaseUrl/reports/products${_dateQuery(from, to)}'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => SummaryRow.fromJson(item)).toList();
  }

  Future<List<SummaryRow>> summaryByCategory({DateTime? from, DateTime? to}) async {
    final response = await http.get(Uri.parse('$apiBaseUrl/reports/categories${_dateQuery(from, to)}'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => SummaryRow.fromJson(item)).toList();
  }

  Future<List<int>> exportReport({DateTime? from, DateTime? to}) async {
    final response = await http.get(Uri.parse('$apiBaseUrl/reports/export${_dateQuery(from, to)}'), headers: _headers());
    return response.bodyBytes;
  }

  Future<List<TotalRow>> totalsByDay() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/stats/totals-by-day'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => TotalRow.fromJson(item)).toList();
  }

  Future<List<TotalRow>> totalsByMonth() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/stats/totals-by-month'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => TotalRow.fromJson(item)).toList();
  }

  Future<List<AverageRow>> averageByCategory() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/stats/average-daily-by-category'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => AverageRow.fromJson(item)).toList();
  }

  Future<List<AverageRow>> averageByProduct() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/stats/average-daily-by-product'), headers: _headers());
    final data = jsonDecode(response.body) as List<dynamic>;
    return data.map((item) => AverageRow.fromJson(item)).toList();
  }

  Map<String, String> _headers({bool json = true}) {
    final token = tokenProvider();
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  String _dateQuery(DateTime? from, DateTime? to) {
    final params = <String>[];
    if (from != null) params.add('from=${from.toIso8601String()}');
    if (to != null) params.add('to=${to.toIso8601String()}');
    if (params.isEmpty) return '';
    return '?${params.join('&')}';
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

class Category {
  Category({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.iconName,
    required this.colorHex,
    required this.active,
  });

  final String id;
  final String name;
  final String imageUrl;
  final String iconName;
  final String colorHex;
  final bool active;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        imageUrl: json['imageUrl'] as String,
        iconName: json['iconName'] as String? ?? 'category',
        colorHex: json['colorHex'] as String? ?? '#0EA5E9',
        active: json['active'] as bool? ?? true,
      );
}

class Product {
  Product({
    required this.id,
    required this.name,
    required this.price,
    required this.imageUrl,
    required this.categoryId,
    required this.active,
    this.iconName,
    this.colorHex,
    this.categoryName,
    this.categoryIconName,
    this.categoryColorHex,
  });

  final String id;
  final String name;
  final double price;
  final String imageUrl;
  final String categoryId;
  final bool active;
  final String? iconName;
  final String? colorHex;
  final String? categoryName;
  final String? categoryIconName;
  final String? categoryColorHex;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        imageUrl: json['imageUrl'] as String,
        categoryId: json['categoryId'] as String,
        active: json['active'] as bool? ?? true,
        iconName: json['iconName'] as String?,
        colorHex: json['colorHex'] as String?,
        categoryName: json['category'] != null ? json['category']['name'] as String : null,
        categoryIconName: json['category'] != null ? json['category']['iconName'] as String? : null,
        categoryColorHex: json['category'] != null ? json['category']['colorHex'] as String? : null,
      );
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

class User {
  User({required this.id, required this.name, required this.email, required this.role, required this.active});

  final String id;
  final String name;
  final String email;
  final String role;
  final bool active;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        active: json['active'] as bool? ?? true,
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
    return '$apiBaseUrl$url';
  }
  return '$apiBaseUrl/$url';
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

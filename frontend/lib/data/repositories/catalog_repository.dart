import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../main.dart';
import '../local/catalog_db.dart';

class CatalogRepository {
  CatalogRepository({
    CatalogDatabase? database,
    Connectivity? connectivity,
    ApiService? apiService,
  })  : _databaseFuture = database == null ? CatalogDatabase.open() : Future.value(database),
        _connectivity = connectivity ?? Connectivity(),
        _apiService = apiService ?? ApiService();

  static const _lastSyncKey = 'catalog_last_sync';
  static CatalogRepository? _instance;

  final Future<CatalogDatabase> _databaseFuture;
  final Connectivity _connectivity;
  final ApiService _apiService;
  final ValueNotifier<bool> isSyncing = ValueNotifier<bool>(false);
  final StreamController<List<Category>> _categoriesController = StreamController.broadcast();
  final Map<String, StreamController<List<Product>>> _productControllers = {};

  static CatalogRepository get instance {
    _instance ??= CatalogRepository();
    return _instance!;
  }

  Stream<List<Category>> watchCategories() {
    _emitCategories();
    return _categoriesController.stream;
  }

  Stream<List<Product>> watchProducts(String categoryId) {
    final controller = _productControllers.putIfAbsent(
      categoryId,
      () => StreamController<List<Product>>.broadcast(),
    );
    _emitProducts(categoryId);
    return controller.stream;
  }

  Future<bool> hasLocalCache() async {
    final db = await _databaseFuture;
    final count = await db.loadCategories().then((rows) => rows.length);
    return count > 0;
  }

  Future<void> syncCatalogIfNeeded({bool force = false}) async {
    if (isSyncing.value) return;
    final local = await hasLocalCache();
    if (!local || force) {
      await syncCatalog();
    } else {
      unawaited(syncCatalog());
    }
  }

  Future<void> syncCatalog() async {
    if (isSyncing.value) return;
    final connectivity = await _connectivity.checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      if (kDebugMode) {
        debugPrint('Catalog sync skipped: offline');
      }
      return;
    }
    isSyncing.value = true;
    final stopwatch = Stopwatch()..start();
    try {
      final categoryFetch = Stopwatch()..start();
      final categories = await _apiService.getCategories();
      categoryFetch.stop();
      final productFetch = Stopwatch()..start();
      final products = await _apiService.getProductsAll();
      productFetch.stop();
      final db = await _databaseFuture;
      await db.upsertCategories(categories.map(_categoryToRow).toList());
      await db.upsertProducts(products.map(_productToRow).toList());
      await _emitCategories();
      for (final entry in _productControllers.keys) {
        await _emitProducts(entry);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_lastSyncKey, DateTime.now().toIso8601String());
      if (kDebugMode) {
        debugPrint(
          'Catalog sync done in ${stopwatch.elapsedMilliseconds}ms '
          '(categories ${categoryFetch.elapsedMilliseconds}ms, '
          'products ${productFetch.elapsedMilliseconds}ms)',
        );
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Catalog sync failed: $error');
      }
    } finally {
      isSyncing.value = false;
    }
  }

  Future<void> logLocalReadTimings() async {
    final stopwatch = Stopwatch()..start();
    final db = await _databaseFuture;
    await db.loadCategories();
    stopwatch.stop();
    if (kDebugMode) {
      debugPrint('Catalog local read: ${stopwatch.elapsedMilliseconds}ms');
    }
  }

  Future<void> clearCache() async {
    final db = await _databaseFuture;
    await db.clearAll();
    await _emitCategories();
    for (final entry in _productControllers.keys) {
      await _emitProducts(entry);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lastSyncKey);
  }

  Future<void> _emitCategories() async {
    final db = await _databaseFuture;
    final rows = await db.loadCategories();
    _categoriesController.add(_mapCategoriesFromRows(rows));
  }

  Future<void> _emitProducts(String categoryId) async {
    final db = await _databaseFuture;
    final rows = await db.loadProducts(categoryId);
    final controller = _productControllers[categoryId];
    controller?.add(_mapProductsFromRows(rows));
  }

  List<Category> _mapCategoriesFromRows(List<QueryRow> rows) {
    return rows
        .map(
          (row) => Category(
            id: row.read<String>('id'),
            name: row.read<String>('name'),
            iconName: row.read<String>('icon_name'),
            colorHex: row.read<String>('color_hex'),
            active: row.read<int>('active') == 1,
            imagePath: row.readNullable<String>('image_url'),
            imageUpdatedAt: _parseDate(row.readNullable<String>('updated_at')),
            updatedAt: _parseDate(row.readNullable<String>('updated_at')),
          ),
        )
        .toList();
  }

  List<Product> _mapProductsFromRows(List<QueryRow> rows) {
    return rows
        .map(
          (row) => Product(
            id: row.read<String>('id'),
            name: row.read<String>('name'),
            price: row.read<double>('price'),
            categoryId: row.read<String>('category_id'),
            active: row.read<int>('active') == 1,
            iconName: row.readNullable<String>('icon_name'),
            colorHex: row.readNullable<String>('color_hex'),
            imagePath: row.readNullable<String>('image_url'),
            imageUpdatedAt: _parseDate(row.readNullable<String>('updated_at')),
            updatedAt: _parseDate(row.readNullable<String>('updated_at')),
          ),
        )
        .toList();
  }

  Map<String, dynamic> _categoryToRow(Category category) {
    return {
      'id': category.id,
      'name': category.name,
      'icon_name': category.iconName,
      'color_hex': category.colorHex,
      'image_url': category.imagePath,
      'updated_at': category.updatedAt?.toIso8601String(),
      'active': category.active ? 1 : 0,
    };
  }

  Map<String, dynamic> _productToRow(Product product) {
    return {
      'id': product.id,
      'name': product.name,
      'price': product.price,
      'icon_name': product.iconName,
      'color_hex': product.colorHex,
      'image_url': product.imagePath,
      'category_id': product.categoryId,
      'updated_at': product.updatedAt?.toIso8601String(),
      'active': product.active ? 1 : 0,
    };
  }

  DateTime? _parseDate(String? value) {
    if (value == null || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}

import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:drift/web.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class CatalogDatabase extends DatabaseConnectionUser {
  CatalogDatabase._(DatabaseConnection connection) : super.connect(connection);

  static Future<CatalogDatabase> open() async {
    final executor = await _openConnection();
    final connection = DatabaseConnection(executor);
    final database = CatalogDatabase._(connection);
    await database._init();
    return database;
  }

  static Future<QueryExecutor> _openConnection() async {
    if (kIsWeb) {
      return WebDatabase('catalog_cache');
    }
    final directory = await getApplicationDocumentsDirectory();
    final dbFile = File(p.join(directory.path, 'catalog_cache.sqlite'));
    return NativeDatabase.createInBackground(dbFile);
  }

  Future<void> _init() async {
    await customStatement('''
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_name TEXT NOT NULL DEFAULT 'category',
        color_hex TEXT NOT NULL DEFAULT '#0EA5E9',
        image_url TEXT,
        updated_at TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
    ''');
    await customStatement('''
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        icon_name TEXT,
        color_hex TEXT,
        image_url TEXT,
        category_id TEXT NOT NULL,
        updated_at TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
    ''');
  }

  Future<void> clearAll() async {
    await customStatement('DELETE FROM categories;');
    await customStatement('DELETE FROM products;');
  }

  Stream<List<QueryRow>> watchCategories() {
    return customSelect('SELECT * FROM categories ORDER BY name ASC').watch();
  }

  Stream<List<QueryRow>> watchProducts(String categoryId) {
    return customSelect(
      'SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY name ASC',
      variables: [Variable(categoryId)],
    ).watch();
  }

  Future<List<QueryRow>> loadCategories() {
    return customSelect('SELECT * FROM categories').get();
  }

  Future<List<QueryRow>> loadProducts(String categoryId) {
    return customSelect(
      'SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY name ASC',
      variables: [Variable(categoryId)],
    ).get();
  }

  Future<void> upsertCategories(List<Map<String, dynamic>> items) async {
    await batch((batch) {
      for (final item in items) {
        batch.customStatement(
          '''
          INSERT INTO categories (id, name, icon_name, color_hex, image_url, updated_at, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            icon_name = excluded.icon_name,
            color_hex = excluded.color_hex,
            image_url = excluded.image_url,
            updated_at = excluded.updated_at,
            active = excluded.active;
          ''',
          [
            item['id'],
            item['name'],
            item['icon_name'],
            item['color_hex'],
            item['image_url'],
            item['updated_at'],
            item['active'],
          ],
        );
      }
    });
  }

  Future<void> upsertProducts(List<Map<String, dynamic>> items) async {
    await batch((batch) {
      for (final item in items) {
        batch.customStatement(
          '''
          INSERT INTO products (id, name, price, icon_name, color_hex, image_url, category_id, updated_at, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            price = excluded.price,
            icon_name = excluded.icon_name,
            color_hex = excluded.color_hex,
            image_url = excluded.image_url,
            category_id = excluded.category_id,
            updated_at = excluded.updated_at,
            active = excluded.active;
          ''',
          [
            item['id'],
            item['name'],
            item['price'],
            item['icon_name'],
            item['color_hex'],
            item['image_url'],
            item['category_id'],
            item['updated_at'],
            item['active'],
          ],
        );
      }
    });
  }
}

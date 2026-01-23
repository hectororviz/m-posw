import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  AppConfig._(this.defaultBaseUrl, this.configPin)
      : baseUrl = ValueNotifier<String>(defaultBaseUrl);

  static const _storageKey = 'backend_base_url';
  static AppConfig? _instance;

  final String defaultBaseUrl;
  final String? configPin;
  final ValueNotifier<String> baseUrl;

  static AppConfig get instance {
    final instance = _instance;
    if (instance == null) {
      throw StateError('AppConfig must be initialized before use.');
    }
    return instance;
  }

  static Future<void> initialize() async {
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      // Optional .env not found.
    }
    const flavor = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
    final fallbackBaseUrl =
        const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    final envBaseUrlKey =
        flavor == 'prod' ? 'API_BASE_URL_PROD' : flavor == 'dev' ? 'API_BASE_URL_DEV' : null;
    final envBaseUrl = envBaseUrlKey == null ? null : dotenv.maybeGet(envBaseUrlKey);
    final defaultBaseUrl = (envBaseUrl ?? dotenv.maybeGet('API_BASE_URL') ?? fallbackBaseUrl).trim();
    final configPin = dotenv.maybeGet('CONFIG_PIN') ?? const String.fromEnvironment('CONFIG_PIN');
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_storageKey);
    final normalizedDefault = normalizeBaseUrl(defaultBaseUrl);
    _instance = AppConfig._(normalizedDefault, configPin?.trim().isEmpty ?? true ? null : configPin);
    if (stored != null && stored.trim().isNotEmpty) {
      _instance!.baseUrl.value = stored;
    }
    if (kDebugMode) {
      debugPrint('AppConfig initialized flavor=$flavor baseUrl=${_instance!.baseUrl.value}');
    }
  }

  static String normalizeBaseUrl(String input) {
    var value = input.trim();
    if (value.endsWith('/')) {
      value = value.substring(0, value.length - 1);
    }
    return value;
  }

  Future<void> setBaseUrl(String value) async {
    final normalized = normalizeBaseUrl(value);
    baseUrl.value = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, normalized);
  }

  Future<void> resetBaseUrl() async {
    baseUrl.value = defaultBaseUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}

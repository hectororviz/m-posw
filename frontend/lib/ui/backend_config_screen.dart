import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../data/repositories/catalog_repository.dart';

class BackendConfigScreen extends StatefulWidget {
  const BackendConfigScreen({super.key});

  @override
  State<BackendConfigScreen> createState() => _BackendConfigScreenState();
}

class _BackendConfigScreenState extends State<BackendConfigScreen> {
  final _urlController = TextEditingController();
  bool _testing = false;
  String? _testResult;

  @override
  void initState() {
    super.initState();
    _urlController.text = AppConfig.instance.baseUrl.value;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _testConnection(String url) async {
    setState(() {
      _testing = true;
      _testResult = null;
    });
    try {
      final normalized = AppConfig.normalizeBaseUrl(url);
      final healthUri = Uri.parse('$normalized/health');
      var response = await http.get(healthUri).timeout(const Duration(seconds: 6));
      if (response.statusCode == 404) {
        final fallbackUri = Uri.parse('$normalized/settings');
        response = await http.get(fallbackUri).timeout(const Duration(seconds: 6));
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        setState(() => _testResult = 'OK (${response.statusCode})');
      } else {
        setState(() => _testResult = 'ERROR (${response.statusCode})');
      }
    } on TimeoutException {
      setState(() => _testResult = 'ERROR (timeout)');
    } catch (error) {
      setState(() => _testResult = 'ERROR ($error)');
    } finally {
      setState(() => _testing = false);
    }
  }

  String? _validate(String input) {
    final trimmed = input.trim();
    if (trimmed.isEmpty) return 'La URL no puede estar vacía';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'Debe iniciar con http:// o https://';
    }
    final uri = Uri.tryParse(trimmed);
    if (uri == null || uri.host.isEmpty) {
      return 'URL inválida';
    }
    return null;
  }

  Future<void> _saveUrl() async {
    final value = _urlController.text;
    final error = _validate(value);
    if (error != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      }
      return;
    }
    await _testConnection(value);
    if (_testResult?.startsWith('OK') ?? false) {
      await AppConfig.instance.setBaseUrl(value);
      await CatalogRepository.instance.clearCache();
      await CatalogRepository.instance.syncCatalogIfNeeded(force: true);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('URL actualizada y catálogo sincronizado.')));
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo validar la URL.')),
        );
      }
    }
  }

  Future<void> _resetToDefault() async {
    await AppConfig.instance.resetBaseUrl();
    setState(() {
      _urlController.text = AppConfig.instance.baseUrl.value;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('URL restablecida al valor por defecto.')),
      );
    }
  }

  Future<void> _clearCache() async {
    await CatalogRepository.instance.clearCache();
    await DefaultCacheManager().emptyCache();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cache local limpiada.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final defaultUrl = AppConfig.instance.defaultBaseUrl;
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración backend')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('URL actual', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(
            controller: _urlController,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: 'Backend URL',
              hintText: 'https://tudominio.com',
            ),
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: 12),
          Text('Default: $defaultUrl'),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                onPressed: _testing ? null : () => _testConnection(_urlController.text),
                icon: const Icon(Icons.wifi_tethering),
                label: Text(_testing ? 'Probando...' : 'Probar conexión'),
              ),
              OutlinedButton.icon(
                onPressed: _testing ? null : _saveUrl,
                icon: const Icon(Icons.save),
                label: const Text('Guardar'),
              ),
              OutlinedButton.icon(
                onPressed: _resetToDefault,
                icon: const Icon(Icons.restore),
                label: const Text('Restablecer'),
              ),
              OutlinedButton.icon(
                onPressed: _clearCache,
                icon: const Icon(Icons.delete_forever),
                label: const Text('Limpiar caché local'),
              ),
            ],
          ),
          if (_testResult != null) ...[
            const SizedBox(height: 16),
            Text('Resultado: $_testResult'),
          ],
          const SizedBox(height: 24),
          Text(
            'Nota: al cambiar la URL se re-sincroniza el catálogo. '
            'El acceso a esta pantalla debe estar protegido por gesto o PIN.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

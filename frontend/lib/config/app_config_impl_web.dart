import 'dart:html' as html;

import 'package:js/js_util.dart' as js_util;

String resolveApiBaseUrl() {
  try {
    final cfg = js_util.getProperty(html.window, '__APP_CONFIG__');
    final dynamic v = cfg == null ? null : js_util.getProperty(cfg, 'API_BASE_URL');
    final url = (v is String) ? v.trim() : '';
    if (url.isEmpty) {
      return '${html.window.location.origin}/api';
    }
    return url;
  } catch (_) {
    return '${html.window.location.origin}/api';
  }
}

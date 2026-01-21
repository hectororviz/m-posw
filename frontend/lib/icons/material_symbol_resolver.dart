import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';
import 'package:material_symbols_icons/symbols.dart';

IconData resolveMaterialSymbol(
  String name, {
  SymbolStyle style = SymbolStyle.outlined,
  IconData fallback = Symbols.help,
}) {
  final normalized = _normalizeMaterialSymbolName(name);
  if (normalized.isEmpty) {
    return fallback;
  }

  final map = SymbolsGet.map;
  if (!map.containsKey(normalized)) {
    return fallback;
  }

  return SymbolsGet.get(normalized, style);
}

String _normalizeMaterialSymbolName(String name) {
  return name.trim().toLowerCase().replaceAll('-', '_');
}

import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';
import 'package:material_symbols_icons/symbols.dart';

IconData resolveMaterialSymbol(String name, {SymbolStyle style = SymbolStyle.outlined}) {
  final normalized = _normalizeMaterialSymbolName(name);
  if (normalized.isEmpty || !Symbols.map.containsKey(normalized)) {
    return Symbols.help;
  }
  return Symbols.get(normalized, style);
}

String _normalizeMaterialSymbolName(String name) {
  return name.trim().toLowerCase().replaceAll('-', '_');
}

import 'dart:async';

import 'package:flutter/material.dart';

import 'icons/material_symbol_resolver.dart';
import 'package:material_symbols_icons/get.dart';
import 'package:material_symbols_icons/symbols.dart';

class IconPickerField extends StatelessWidget {
  const IconPickerField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.allowClear = false,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool allowClear;

  @override
  Widget build(BuildContext context) {
    final iconData = resolveMaterialSymbol(value ?? 'help');
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        suffixIcon: allowClear && value != null
            ? IconButton(
                onPressed: () => onChanged(null),
                icon: const Icon(Icons.clear),
              )
            : null,
      ),
      child: Row(
        children: [
          CircleAvatar(child: Icon(iconData)),
          const SizedBox(width: 12),
          Expanded(child: Text(value ?? 'Seleccionar icono')),
          TextButton(
            onPressed: () async {
              final selection = await showDialog<String>(
                context: context,
                builder: (context) => IconPickerDialog(selected: value),
              );
              if (selection != null) {
                onChanged(selection);
              }
            },
            child: const Text('Elegir'),
          ),
        ],
      ),
    );
  }
}

class IconPickerDialog extends StatefulWidget {
  const IconPickerDialog({super.key, this.selected});

  final String? selected;

  @override
  State<IconPickerDialog> createState() => _IconPickerDialogState();
}

class _IconPickerDialogState extends State<IconPickerDialog> {
  List<String> filtered = [];
  int visibleCount = 0;
  final int pageSize = 200;
  Timer? _debounce;
  late final List<String> allSymbols;

  @override
  void initState() {
    super.initState();
    allSymbols = Symbols.values.map((symbol) => symbol.name).toList()..sort();
    _applyFilter('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _applyFilter(String value) {
    final normalized = value.trim().toLowerCase();
    final matches = normalized.isEmpty
        ? allSymbols
        : allSymbols.where((name) => name.contains(normalized)).toList();
    setState(() {
      filtered = matches;
      visibleCount = matches.length < pageSize ? matches.length : pageSize;
    });
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _applyFilter(value);
    });
  }

  void _showMore() {
    setState(() {
      final nextCount = visibleCount + pageSize;
      visibleCount = nextCount > filtered.length ? filtered.length : nextCount;
    });
  }

  @override
  Widget build(BuildContext context) {
    final visibleSymbols = filtered.take(visibleCount).toList();
    final remaining = filtered.length - visibleCount;
    final nextBatch = remaining < pageSize ? remaining : pageSize;
    return AlertDialog(
      title: const Text('Seleccionar icono'),
      content: SizedBox(
        width: 520,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: const InputDecoration(
                labelText: 'Buscar icono',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: _onQueryChanged,
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 320,
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 6,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: visibleSymbols.length,
                itemBuilder: (context, index) {
                  final name = visibleSymbols[index];
                  final iconData = resolveMaterialSymbol(name);
                  final isSelected = name == widget.selected;
                  return Tooltip(
                    message: name,
                    child: InkResponse(
                      onTap: () => Navigator.pop(context, name),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Theme.of(context).colorScheme.primaryContainer
                              : Theme.of(context).colorScheme.surfaceVariant,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? Theme.of(context).colorScheme.primary : Colors.transparent,
                          ),
                        ),
                        child: Icon(iconData),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (visibleCount < filtered.length)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: TextButton(
                  onPressed: _showMore,
                  child: Text('Mostrar $nextBatch más'),
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
      ],
    );
  }
}

class ColorPickerField extends StatelessWidget {
  const ColorPickerField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.allowClear = false,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool allowClear;

  @override
  Widget build(BuildContext context) {
    final controller = TextEditingController(text: value ?? '');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            suffixIcon: allowClear && value != null
                ? IconButton(
                    onPressed: () => onChanged(null),
                    icon: const Icon(Icons.clear),
                  )
                : null,
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _palette
                .map(
                  (color) => InkWell(
                    onTap: () => onChanged(_toHex(color)),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _toHex(color) == value ? Colors.black : Colors.transparent,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Color HEX (#RRGGBB)'),
          onChanged: (hex) => onChanged(hex),
        ),
      ],
    );
  }
}

const List<Color> _palette = [
  Colors.red,
  Colors.deepOrange,
  Colors.orange,
  Colors.amber,
  Colors.yellow,
  Colors.lime,
  Colors.lightGreen,
  Colors.green,
  Colors.teal,
  Colors.cyan,
  Colors.lightBlue,
  Colors.blue,
  Colors.indigo,
  Colors.deepPurple,
  Colors.purple,
  Colors.pink,
  Colors.brown,
  Colors.grey,
  Colors.blueGrey,
  Colors.black,
];

String _toHex(Color color) {
  final value = color.value & 0xFFFFFF;
  return '#${value.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

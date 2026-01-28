import 'package:flutter/material.dart';

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

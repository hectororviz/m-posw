import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:bluetooth_print_plus/bluetooth_print_plus.dart';
import 'package:permission_handler/permission_handler.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'm-POSw',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  InAppWebViewController? _webViewController;
  BluetoothDevice? _selectedDevice;
  List<BluetoothDevice> _devices = [];
  bool _isPrinting = false;
  bool _isSidebarOpen = false;
  StreamSubscription? _scanSubscription;

  static const String _url = 'https://pos.csdsoler.com.ar';

  @override
  void initState() {
    super.initState();
    _initBluetooth();
  }

  @override
  void dispose() {
    _scanSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initBluetooth() async {
    final bluetoothScan = await Permission.bluetoothScan.request();
    final bluetoothConnect = await Permission.bluetoothConnect.request();

    if (bluetoothScan.isGranted && bluetoothConnect.isGranted) {
      _startScan();
    }
  }

  Future<void> _startScan() async {
    _scanSubscription?.cancel();
    await BluetoothPrintPlus.startScan(timeout: const Duration(seconds: 4));
    _scanSubscription = BluetoothPrintPlus.scanResults.listen((devices) {
      if (mounted) {
        setState(() {
          _devices = devices;
        });
      }
    });
  }

  Future<void> _printTicketFromBase64(String base64Data) async {
    if (_selectedDevice == null) {
      _showMessage('No hay impresor seleccionado');
      return;
    }

    setState(() => _isPrinting = true);

    try {
      await BluetoothPrintPlus.connect(_selectedDevice!);
      await Future.delayed(const Duration(milliseconds: 500));

      final jsonStr = utf8.decode(
        base64Url.decode(base64Data.replaceAll('-', '+').replaceAll('_', '/')),
      );
      final payload = jsonDecode(jsonStr) as Map<String, dynamic>;

      final lines = _formatPayloadToLines(payload);

      final cmd = EscCommand();
      cmd.init();
      for (final line in lines) {
        cmd.addText(line);
        cmd.addFeedLine(1);
      }

      final result = await cmd.getCommand();
      if (result != null) {
        await BluetoothPrintPlus.write(Uint8List.fromList(result));
      }

      _showMessage('Ticket impreso correctamente');
    } catch (e) {
      _showMessage('Error al imprimir: $e');
    } finally {
      setState(() => _isPrinting = false);
    }
  }

  List<String> _formatPayloadToLines(Map<String, dynamic> payload) {
    final lines = <String>[];
    const separator = '----------------------------';
    const maxLineWidth = 32;

    if (payload['clubName'] != null &&
        (payload['clubName'] as String).isNotEmpty) {
      lines.add(payload['clubName'] as String);
    }

    lines.add(payload['storeName'] as String? ?? 'Tienda');

    if (payload['dateTimeISO'] != null) {
      final dateStr = payload['dateTimeISO'] as String;
      final dateMatch = RegExp(
        r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})',
      ).firstMatch(dateStr);
      if (dateMatch != null) {
        lines.add(
          '${dateMatch.group(3)}/${dateMatch.group(2)}/${dateMatch.group(1)} ${dateMatch.group(4)}:${dateMatch.group(5)}',
        );
      }
    }

    if (payload['criteria'] != null) {
      lines.add(separator);
      for (final item in payload['criteria'] as List) {
        final label = item['label'] as String? ?? '';
        final value = item['value'] as String? ?? '';
        lines.add('$label: $value');
      }
    }

    if (payload['items'] != null) {
      final items = List<Map<String, dynamic>>.from(payload['items'] as List);
      items.sort((a, b) {
        final aCat = (a['category'] as String?)?.toLowerCase() ?? '';
        final bCat = (b['category'] as String?)?.toLowerCase() ?? '';
        final aIsBebida = aCat == 'bebida' || aCat == 'bebidas';
        final bIsBebida = bCat == 'bebida' || bCat == 'bebidas';
        final aIsComida = aCat == 'comida';
        final bIsComida = bCat == 'comida';
        if (aIsBebida && !bIsBebida) return -1;
        if (!aIsBebida && bIsBebida) return 1;
        if (aIsComida && !bIsComida) return 1;
        if (!aIsComida && bIsComida) return -1;
        return 0;
      });

      final total = payload['total'] as num?;
      if (total != null) {
        lines.add(separator);
        lines.add('TOTAL: \$${total.toStringAsFixed(2)}');
      }

      lines.add(separator);

      final baseOrderNumber = payload['orderNumber'] as int? ?? 0;

      for (var i = 0; i < items.length; i++) {
        lines.add(separator);

        final item = items[i];
        final qty = item['qty'] as int? ?? 1;
        final name = item['name'] as String? ?? '';
        final nameUpper = name.toUpperCase();
        final orderNum = (baseOrderNumber + i).toString().padLeft(3, '0');

        final productWithQty = '${qty}x $nameUpper';
        final orderNumStr = ' $orderNum';

        if (productWithQty.length + orderNumStr.length <= maxLineWidth) {
          lines.add(productWithQty + orderNumStr);
        } else {
          lines.add(
            productWithQty.substring(0, maxLineWidth - orderNumStr.length),
          );
          final remaining = productWithQty.substring(
            maxLineWidth - orderNumStr.length,
          );
          lines.add(remaining + orderNumStr);
        }
      }

      lines.add(separator);
    }

    if (payload['thanks'] != null) {
      lines.add('');
      lines.add(payload['thanks'] as String);
    }

    if (payload['footer'] != null) {
      lines.add(payload['footer'] as String);
    }

    return lines;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _showPrinterDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        maxChildSize: 0.9,
        minChildSize: 0.3,
        expand: false,
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Impresoras Bluetooth',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  TextButton(
                    onPressed: _startScan,
                    child: const Text('Escanear'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_devices.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No se encontraron impresoras'),
                )
              else
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: _devices.length,
                    itemBuilder: (context, index) {
                      final device = _devices[index];
                      return ListTile(
                        leading: const Icon(Icons.bluetooth),
                        title: Text(device.name ?? 'Sin nombre'),
                        subtitle: Text(device.address ?? ''),
                        selected: _selectedDevice?.address == device.address,
                        onTap: () {
                          setState(() => _selectedDevice = device);
                          Navigator.pop(context);
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: _isSidebarOpen ? 200 : 0,
                child: _isSidebarOpen
                    ? Container(
                        color: Theme.of(
                          context,
                        ).colorScheme.surfaceContainerHighest,
                        child: Column(
                          children: [
                            const SizedBox(height: 60),
                            ListTile(
                              leading: Icon(
                                _selectedDevice != null
                                    ? Icons.bluetooth_connected
                                    : Icons.bluetooth_disabled,
                                color: _selectedDevice != null
                                    ? Colors.green
                                    : null,
                              ),
                              title: Text(
                                _selectedDevice?.name ?? 'Sin impresor',
                              ),
                              subtitle: const Text('Bluetooth'),
                              onTap: _showPrinterDialog,
                            ),
                            const Divider(),
                            ListTile(
                              leading: const Icon(Icons.refresh),
                              title: const Text('Recargar'),
                              onTap: () => _webViewController?.reload(),
                            ),
                            ListTile(
                              leading: const Icon(Icons.close),
                              title: const Text('Cerrar menú'),
                              onTap: () =>
                                  setState(() => _isSidebarOpen = false),
                            ),
                          ],
                        ),
                      )
                    : null,
              ),
              Expanded(
                child: InAppWebView(
                  initialUrlRequest: URLRequest(url: WebUri(_url)),
                  onWebViewCreated: (controller) {
                    _webViewController = controller;
                  },
                  onLoadStart: (controller, url) {
                    debugPrint('Cargando: $url');
                  },
                  onReceivedError: (controller, request, error) {
                    debugPrint('Error: ${error.description}');
                  },
                  shouldOverrideUrlLoading:
                      (controller, navigationAction) async {
                        final uri = navigationAction.request.url;
                        if (uri != null && uri.path == '/printticket') {
                          final ticketData = uri.queryParameters['data'] ?? '';
                          if (ticketData.isNotEmpty) {
                            _printTicketFromBase64(ticketData);
                            return NavigationActionPolicy.CANCEL;
                          }
                        }
                        if (uri != null &&
                            uri.toString().contains('printticket')) {
                          final ticketHtml = uri.queryParameters['html'] ?? '';
                          if (ticketHtml.isNotEmpty) {
                            _printTicketFromBase64(
                              Uri.encodeComponent(ticketHtml),
                            );
                            return NavigationActionPolicy.CANCEL;
                          }
                        }
                        return NavigationActionPolicy.ALLOW;
                      },
                ),
              ),
            ],
          ),
          Positioned(
            bottom: 16,
            left: 16,
            child: GestureDetector(
              onTap: () => setState(() => _isSidebarOpen = !_isSidebarOpen),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: Icon(
                  _isSidebarOpen ? Icons.close : Icons.menu,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ),
          if (_isPrinting)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      'Imprimiendo...',
                      style: TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class EscCommand {
  List<int> _command = [];

  void init() {
    _command = [];
  }

  void addText(String text) {
    _command.addAll(text.codeUnits);
  }

  void addFeedLine(int lines) {
    for (var i = 0; i < lines; i++) {
      _command.add(0x0A);
    }
  }

  Future<List<int>?> getCommand() async {
    return _command;
  }
}

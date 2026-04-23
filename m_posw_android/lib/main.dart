import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
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
  String? _selectedMac;
  String? _selectedName;
  List<BluetoothInfo> _devices = [];
  bool _isPrinting = false;
  bool _isSidebarOpen = false;
  bool _isConnected = false;

  static const String _url = 'https://pos.csdsoler.com.ar';

  @override
  void initState() {
    super.initState();
    _initBluetooth();
  }

  @override
  void dispose() {
    PrintBluetoothThermal.disconnect;
    super.dispose();
  }

  Future<void> _initBluetooth() async {
    // Verificar permisos para Android 12+
    final bluetoothConnect = await Permission.bluetoothConnect.request();
    final bluetoothScan = await Permission.bluetoothScan.request();

    if (bluetoothConnect.isGranted && bluetoothScan.isGranted) {
      _scanDevices();
    }
  }

  Future<void> _scanDevices() async {
    try {
      final List<BluetoothInfo> list = await PrintBluetoothThermal.pairedBluetooths;
      if (mounted) {
        setState(() {
          _devices = list;
        });
      }
      debugPrint('Dispositivos encontrados: ${list.length}');
    } catch (e) {
      debugPrint('Error escaneando dispositivos: $e');
    }
  }

  Future<void> _connectPrinter(String mac, String name) async {
    try {
      // Primero desconectar si hay una conexión activa
      await PrintBluetoothThermal.disconnect;
      await Future.delayed(const Duration(milliseconds: 500));

      // Conectar a la impresora por MAC address
      final bool result = await PrintBluetoothThermal.connect(macPrinterAddress: mac);

      if (result) {
        // Verificar estado de conexión
        await Future.delayed(const Duration(seconds: 1));
        final bool status = await PrintBluetoothThermal.connectionStatus;

        if (mounted) {
          setState(() {
            _selectedMac = mac;
            _selectedName = name;
            _isConnected = status;
          });
        }

        if (status) {
          _showMessage('Conectado a $name');
        } else {
          _showMessage('Error: No se pudo establecer conexión');
        }
      } else {
        _showMessage('Error al conectar a $name');
      }
    } catch (e) {
      _showMessage('Error de conexión: $e');
      debugPrint('Error conectando: $e');
    }
  }

  Future<void> _printTicketFromBase64(String base64Data) async {
    if (_selectedMac == null) {
      _showMessage('No hay impresor seleccionado');
      return;
    }

    setState(() => _isPrinting = true);

    try {
      // 1. VERIFICAR/ESTABLECER CONEXIÓN SPP
      bool isConnected = await PrintBluetoothThermal.connectionStatus;

      if (!isConnected) {
        debugPrint('Reconectando a $_selectedMac...');
        final bool connected = await PrintBluetoothThermal.connect(
          macPrinterAddress: _selectedMac!,
        );
        if (!connected) {
          throw Exception('No se pudo conectar a la impresora');
        }
        // Esperar a que el socket SPP se estabilice
        await Future.delayed(const Duration(seconds: 2));
      }

      // Verificar nuevamente
      isConnected = await PrintBluetoothThermal.connectionStatus;
      if (!isConnected) {
        throw Exception('La impresora no responde');
      }

      // 2. DECODIFICAR DATOS
      final decodedBase64 = Uri.decodeComponent(base64Data);
      final jsonStr = utf8.decode(base64.decode(decodedBase64));
      final payload = jsonDecode(jsonStr) as Map<String, dynamic>;

      debugPrint('Payload recibido: $payload');

      // 3. GENERAR COMANDOS ESC/POS
      final List<int> bytes = await _generateEscPosCommands(payload);

      // 4. ENVIAR BYTES POR SOCKET SPP
      debugPrint('Enviando ${bytes.length} bytes a la impresora...');
      final bool result = await PrintBluetoothThermal.writeBytes(bytes);

      if (!result) {
        throw Exception('Error al enviar datos a la impresora');
      }

      // Esperar a que se procese la impresión
      await Future.delayed(const Duration(milliseconds: 1000));

      _showMessage('Ticket impreso correctamente');
    } on PlatformException catch (e) {
      _showMessage('Error Bluetooth: ${e.message}');
      debugPrint('PlatformException: $e');
    } catch (e) {
      _showMessage('Error al imprimir: $e');
      debugPrint('Error: $e');
    } finally {
      // 5. CERRAR CONEXIÓN SPP
      try {
        debugPrint('Cerrando conexión SPP...');
        await PrintBluetoothThermal.disconnect;
        setState(() => _isConnected = false);
      } catch (e) {
        debugPrint('Error al desconectar: $e');
      }
      setState(() => _isPrinting = false);
    }
  }

  Future<List<int>> _generateEscPosCommands(Map<String, dynamic> payload) async {
    // Usar perfil por defecto para impresoras térmicas comunes
    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);

    List<int> bytes = [];

    // Reset de la impresora
    bytes += generator.reset();

    // Configurar code page para caracteres especiales (tildes, ñ, etc.)
    bytes += generator.setGlobalCodeTable('CP1252');

    const separator = '------------------------------';
    const maxLineWidth = 32;

    // CLUB NAME (centrado, grande si existe)
    if (payload['clubName'] != null && (payload['clubName'] as String).isNotEmpty) {
      bytes += generator.text(
        payload['clubName'] as String,
        styles: const PosStyles(
          align: PosAlign.center,
          height: PosTextSize.size2,
          width: PosTextSize.size2,
          bold: true,
        ),
      );
      bytes += generator.feed(1);
    }

    // STORE NAME (centrado)
    bytes += generator.text(
      payload['storeName'] as String? ?? 'Tienda',
      styles: const PosStyles(
        align: PosAlign.center,
        bold: true,
      ),
    );

    // FECHA Y HORA
    if (payload['dateTimeISO'] != null) {
      final dateStr = payload['dateTimeISO'] as String;
      final dateMatch = RegExp(
        r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})',
      ).firstMatch(dateStr);
      if (dateMatch != null) {
        final formatted = '${dateMatch.group(3)}/${dateMatch.group(2)}/${dateMatch.group(1)} ${dateMatch.group(4)}:${dateMatch.group(5)}';
        bytes += generator.text(
          formatted,
          styles: const PosStyles(align: PosAlign.center),
        );
      }
    }

    bytes += generator.feed(1);

    // CRITERIA (mesa, etc.)
    if (payload['criteria'] != null) {
      bytes += generator.text(separator);
      for (final item in payload['criteria'] as List) {
        final label = item['label'] as String? ?? '';
        final value = item['value'] as String? ?? '';
        bytes += generator.text('$label: $value');
      }
      bytes += generator.feed(1);
    }

    // ITEMS
    if (payload['items'] != null) {
      final items = List<Map<String, dynamic>>.from(payload['items'] as List);

      // Ordenar: bebidas primero, luego comidas
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

      // TOTAL
      final total = payload['total'] as num?;
      if (total != null) {
        bytes += generator.text(separator);
        bytes += generator.row([
          PosColumn(
            text: 'TOTAL:',
            width: 6,
            styles: const PosStyles(bold: true),
          ),
          PosColumn(
            text: '\$${total.toStringAsFixed(2)}',
            width: 6,
            styles: const PosStyles(
              align: PosAlign.right,
              bold: true,
              height: PosTextSize.size2,
            ),
          ),
        ]);
      }

      bytes += generator.feed(1);

      // LISTA DE ITEMS
      for (var i = 0; i < items.length; i++) {
        bytes += generator.text(separator);

        final item = items[i];
        final qtyVal = item['qty'];
        final qty = qtyVal is int ? qtyVal : (qtyVal is num ? qtyVal.toInt() : 1);
        final name = item['name'] as String? ?? '';
        final nameUpper = name.toUpperCase();
        final orderNumVal = item['orderNumber'];
        final orderNumInt = orderNumVal is int ? orderNumVal : (orderNumVal is num ? orderNumVal.toInt() : 0);
        final orderNum = orderNumInt.toString().padLeft(3, '0');

        // Cantidad x Nombre (grande)
        bytes += generator.text(
          '${qty}x $nameUpper',
          styles: const PosStyles(
            bold: true,
            height: PosTextSize.size2,
            width: PosTextSize.size2,
          ),
        );

        // Número de orden alineado a la derecha
        bytes += generator.text(
          orderNum.padLeft(maxLineWidth),
          styles: const PosStyles(
            align: PosAlign.right,
            height: PosTextSize.size3,
            width: PosTextSize.size3,
          ),
        );
      }

      bytes += generator.text(separator);
    }

    // MENSAJE DE AGRADECIMIENTO
    if (payload['thanks'] != null) {
      bytes += generator.feed(1);
      bytes += generator.text(
        payload['thanks'] as String,
        styles: const PosStyles(align: PosAlign.center),
      );
    }

    // FOOTER
    if (payload['footer'] != null) {
      bytes += generator.text(
        payload['footer'] as String,
        styles: const PosStyles(align: PosAlign.center),
      );
    }

    // Feed y corte de papel
    bytes += generator.feed(3);
    bytes += generator.cut();

    return bytes;
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
                    onPressed: _scanDevices,
                    child: const Text('Actualizar'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Selecciona una impresora emparejada:',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              if (_devices.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No se encontraron impresoras.\nEmpareja la impresora en configuración Bluetooth.'),
                )
              else
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: _devices.length,
                    itemBuilder: (context, index) {
                      final device = _devices[index];
                      final isSelected = _selectedMac == device.macAdress;
                      return ListTile(
                        leading: Icon(
                          Icons.bluetooth,
                          color: isSelected ? Colors.green : null,
                        ),
                        title: Text(device.name),
                        subtitle: Text(device.macAdress),
                        selected: isSelected,
                        trailing: isSelected
                          ? const Icon(Icons.check_circle, color: Colors.green)
                          : null,
                        onTap: () async {
                          Navigator.pop(context);
                          await _connectPrinter(device.macAdress, device.name);
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
                                _isConnected
                                    ? Icons.bluetooth_connected
                                    : Icons.bluetooth_disabled,
                                color: _isConnected ? Colors.green : Colors.grey,
                              ),
                              title: Text(
                                _selectedName ?? 'Sin impresor',
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(_isConnected ? 'Conectado' : 'Desconectado'),
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
                  color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
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

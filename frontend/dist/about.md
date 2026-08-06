# Acerca de m-POSw

**m-POSw** (Mini POS Web) es un sistema de punto de venta diseñado para jornadas, eventos, comercios y clubes.

## Versión
Versión 2.1.0

## Novedades de la versión 2.1
- **Padrón de Socios**: CRUD de socios, tipos de socio, cuotas mensuales, pagos, control de deuda, reporte de matriz de cuotas y KPIs de tesorería.
- **Beneficios y descuentos**: Descuentos configurables por tipo de socio (porcentaje sobre categorías o productos), topes en $ y límites diarios. Aplicación automática al escanear QR del socio en el POS.
- **Credenciales imprimibles**: Carnet individual en PDF (CR80) o masivos con selección múltiple (grilla 2×4, 8 por hoja A4). QR escaneable desde el POS para aplicar descuentos.
- **Módulos configurables**: Solapa "Módulos" en Configuración para habilitar/deshabilitar Socios, Tesorería y Acreedores según necesidad.
- **Módulo de Acreedores**: Ventas fiadas con control de deuda, lógica FIFO, registro de pagos y alertas de morosidad.

## Novedades de la versión 2
- **Módulo de Tesorería**: Libro Diario con partida doble, plan de cuentas jerárquico, asientos contables (DRAFT/POSTED/VOIDED) y reportes exportables a Excel (Libro Diario, Mayor, Balance de Sumas y Saldos, Estado de Resultados, Disponibilidades).
- **OAuth Mercado Pago**: Vinculación automática de tu cuenta de MP vía OAuth 2.0. Sin necesidad de configurar tokens manualmente. Detección y selección de tiendas/POS existentes, o creación automática del POS QR. Renovación proactiva de tokens cada 6 horas.
- **Modo Oscuro**: Tema dark completo en toda la interfaz, con cambio automático según preferencia del sistema y toggle manual.
- **Rediseño completo de UI**: KPIs con badges y charts modernos, sidebar colapsable responsive, vista compacta de productos en tabla, rediseño de Ventas, Estadísticas, Categorías, Stock y Configuración.
- **Zoom de productos**: Vista ampliada de productos en el POS táctil.
- **Gestión de usuarios en Configuración**: Creación, edición y eliminación de usuarios integrada en la pantalla de Configuración.
- **Descarga de APK**: Botón directo a la última versión de la APK Android desde Configuración.

## Características principales
- **POS táctil**: Interfaz intuitiva para tablets y celulares
- **Múltiples métodos de pago**: Efectivo, Mercado Pago QR, Transferencias y Fiado
- **Gestión de productos**: Productos simples, compuestos (recetas) y materia prima
- **Control de stock**: Seguimiento en tiempo real del inventario
- **Padrón de socios**: Carnets, cuotas, beneficios y descuentos automáticos en el POS
- **Cierre de caja**: Desglose por método de pago con movimientos de entrada/salida
- **Reportes**: Exportación a Excel con filtros por fecha
- **Estadísticas**: Gráficos de ventas y análisis con KPIs
- **Múltiples cajas**: Varias cajas operando en simultáneo con admin centralizado

## Tecnologías
- **Frontend**: React + Vite + TypeScript
- **Backend**: NestJS + Prisma
- **Base de datos**: PostgreSQL
- **Infraestructura**: Docker Compose
- **Pagos**: API Mercado Pago (Instore QR v2, OAuth 2.0, Search payments) + Fiado
- **App Android**: Flutter + WebView + impresión Bluetooth nativa

## Contacto
Para soporte o consultas, contactar al administrador del sistema.

## Licencia
MIT

---
Programa confeccionado íntegramente con IA (Codex)

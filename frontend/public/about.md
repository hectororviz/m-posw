# Acerca de m-POSw

**m-POSw** (Mini POS Web) es un sistema de punto de venta diseñado para jornadas, eventos y comercios.

## Versión
Versión 2.0.0

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
- **Múltiples métodos de pago**: Efectivo, Mercado Pago QR y Transferencias
- **Gestión de productos**: Productos simples, compuestos (recetas) y materia prima
- **Control de stock**: Seguimiento en tiempo real del inventario
- **Cierre de caja**: Desglose por método de pago con movimientos de entrada/salida
- **Reportes**: Exportación a Excel con filtros por fecha
- **Estadísticas**: Gráficos de ventas y análisis con KPIs
- **Múltiples cajas**: Varias cajas operando en simultáneo con admin centralizado

## Tecnologías
- **Frontend**: React + Vite + TypeScript
- **Backend**: NestJS + Prisma
- **Base de datos**: PostgreSQL
- **Infraestructura**: Docker Compose
- **Pagos**: API Mercado Pago (Instore QR v2, OAuth 2.0, Search payments)
- **App Android**: Flutter + WebView + impresión Bluetooth nativa

## Contacto
Para soporte o consultas, contactar al administrador del sistema.

## Licencia
MIT

---
Programa confeccionado íntegramente con IA (Codex)

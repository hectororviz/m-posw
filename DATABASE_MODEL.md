# Modelo de Base de Datos - M-POSW

## 📊 Base de Datos: PostgreSQL con Prisma ORM

Archivo schema: `backend/prisma/schema.prisma`

---

## 📌 Tablas y Campos

### **1. User** (Usuarios)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| email | String? | Email único (opcional) |
| password | String | Contraseña hasheada |
| name | String | Nombre único del usuario |
| role | Role (enum) | ADMIN o USER |
| active | Boolean | Usuario activo/inactivo |
| externalPosId | String? | ID de POS externo (MP) |
| externalStoreId | String? | ID de tienda externa (MP) |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Sale (ventas del usuario)
- `1:N` → CashClose (cierres de caja)
- `1:N` → CashMovement (movimientos de caja)
- `1:N` → Session (sesiones)
- `1:N` → ManualMovement (movimientos manuales)

---

### **2. Category** (Categorías de productos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| name | String | Nombre de la categoría |
| iconName | String | Nombre del icono |
| colorHex | String | Color en hexadecimal |
| imagePath | String? | Ruta de la imagen |
| imageUpdatedAt | DateTime? | Fecha de actualización de imagen |
| active | Boolean | Activa/inactiva |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Product (productos de la categoría)

---

### **3. Product** (Productos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| name | String | Nombre del producto |
| price | Decimal(10,2) | Precio |
| stock | Int | Stock disponible (default: 0) |
| iconName | String? | Nombre del icono |
| colorHex | String? | Color en hexadecimal |
| imagePath | String? | Ruta de la imagen |
| imageUpdatedAt | DateTime? | Fecha de actualización de imagen |
| active | Boolean | Activo/inactivo |
| categoryId | UUID (FK) | Referencia a Category |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → Category (pertenece a una categoría)
- `1:N` → SaleItem (ítems de venta)
- `1:1` → ProductOrderCounter (contador de órdenes)

---

### **4. Sale** (Ventas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| orderNumber | Int (autoincrement) | Número de orden |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |
| total | Decimal(10,2) | Total de la venta |
| status | SaleStatus (enum) | PENDING/APPROVED/REJECTED/EXPIRED/CANCELLED |
| paymentStatus | PaymentStatus (enum) | PENDING/APPROVED/REJECTED/EXPIRED |
| paymentMethod | PaymentMethod (enum) | CASH/MP_QR/TRANSFER |
| statusUpdatedAt | DateTime | Fecha de actualización de estado |
| paymentStartedAt | DateTime? | Inicio del pago |
| paidAt | DateTime? | Fecha de pago |
| ticketPrintedAt | DateTime? | Fecha de impresión de ticket |
| cancelledAt | DateTime? | Fecha de cancelación |
| expiredAt | DateTime? | Fecha de expiración |
| cashReceived | Decimal(10,2)? | Efectivo recibido |
| changeAmount | Decimal(10,2)? | Cambio |
| mpExternalReference | String? | Referencia externa MP |
| mpOrderId | String? | ID de orden MP |
| mpPaymentId | String? | ID de pago MP |
| mpMerchantOrderId | String? | ID de orden comerciante MP |
| mpQrData | String? | Datos del QR de MP |
| mpStatus | String? | Estado de MP |
| mpStatusDetail | String? | Detalle de estado MP |
| mpRaw | Json? | Datos crudos de MP |
| userId | UUID (FK) | Usuario que realizó la venta |

**Relaciones:**
- `N:1` → User (vendedor)
- `1:N` → SaleItem (ítems de la venta)
- `1:N` → MercadoPagoPayment (pagos MP)
- `1:N` → MovimientoMP (movimientos MP)

---

### **5. SaleItem** (Ítems de venta)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| orderNumber | Int (autoincrement) | Número de orden del ítem |
| saleId | UUID (FK) | Referencia a Sale |
| productId | UUID (FK) | Referencia a Product |
| quantity | Int | Cantidad |
| subtotal | Decimal(10,2) | Subtotal |

**Relaciones:**
- `N:1` → Sale (pertenece a una venta)
- `N:1` → Product (producto vendido)

---

### **6. CashClose** (Cierres de caja)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| from | DateTime | Inicio del período |
| to | DateTime | Fin del período |
| closedAt | DateTime | Fecha de cierre |
| closedByUserId | UUID (FK) | Usuario que cerró |
| note | String? | Nota opcional |
| salesCashTotal | Decimal(10,2) | Total en efectivo |
| salesQrTotal | Decimal(10,2) | Total en QR |
| salesTotal | Decimal(10,2) | Total general |
| salesCount | Int | Cantidad de ventas |
| movementsOutTotal | Decimal(10,2) | Total salidas |
| movementsInTotal | Decimal(10,2) | Total entradas |
| movementsNet | Decimal(10,2) | Neto de movimientos |
| netCashDelta | Decimal(10,2) | Delta de efectivo |
| movementsCount | Int | Cantidad de movimientos |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → User (usuario que cerró)

---

### **7. CashMovement** (Movimientos de caja)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| type | CashMovementType (enum) | INCOME/EXPENSE |
| amount | Decimal(10,2) | Monto |
| reason | String? | Razón |
| isVoided | Boolean | Anulado |
| createdAt | DateTime | Fecha de creación |
| createdByUserId | UUID (FK) | Usuario que creó |

**Relaciones:**
- `N:1` → User (creador)

---

### **8. ManualMovement** (Movimientos manuales)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| type | MovementType (enum) | ENTRADA/SALIDA |
| amount | Decimal(10,2) | Monto |
| reason | String | Razón |
| userId | UUID (FK) | Usuario |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → User

---

### **9. Session** (Sesiones de usuario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| userId | UUID (FK) | Usuario |
| createdAt | DateTime | Fecha de creación |
| revokedAt | DateTime? | Fecha de revocación |

**Relaciones:**
- `N:1` → User

---

### **10. MercadoPagoPayment** (Pagos de MP)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| saleId | UUID (FK) | Venta asociada |
| paymentId | String? | ID de pago MP |
| status | String | Estado |
| approvedAt | DateTime? | Fecha de aprobación |
| payload | Json? | Datos del pago |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → Sale

---

### **11. MovimientoMP** (Movimientos de MP)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| saleId | UUID? (FK) | Venta asociada (opcional) |
| paymentId | String (unique) | ID de pago MP |
| monto | Decimal(10,2) | Monto recibido |
| montoEsperado | Decimal(10,2) | Monto esperado |
| pagador | String? | Pagador |
| tipo | String? | Tipo |
| fecha | DateTime | Fecha del movimiento |
| notificado | Boolean | Flag de notificación |
| procesado | Boolean | Flag de procesado |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → Sale (opcional)

---

### **12. Setting** (Configuración)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| storeName | String | Nombre de la tienda |
| clubName | String | Nombre del club |
| enableTicketPrinting | Boolean | Habilitar impresión |
| logoUrl | String? | URL del logo |
| faviconUrl | String? | URL del favicon |
| okAnimationUrl | String? | URL de animación OK |
| errorAnimationUrl | String? | URL de animación error |
| accentColor | String? | Color de acento |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

---

### **13. ProductOrderCounter** (Contador de órdenes por producto)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| productId | UUID (FK, unique) | Producto |
| lastOrderNumber | Int | Último número de orden |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:1` → Product

---

### **14. PaymentEvent** (Eventos de pago)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| provider | String | Proveedor |
| topic | String | Tópico |
| resourceId | String | ID del recurso |
| createdAt | DateTime | Fecha de creación |

---

## 🔗 Diagrama de Relaciones

```
┌─────────────────────────────────────────────────────────────────┐
│                            USER                                 │
├─────────────────────────────────────────────────────────────────┤
│  1:N → Sales, CashCloses, CashMovements, Sessions,              │
│        ManualMovements                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐         ┌──────────┐         ┌─────────────┐
   │  Sale   │◄──1:N───┤ SaleItem │───N:1──►│   Product   │
   └────┬────┘         └──────────┘         └──────┬──────┘
        │                                           │
        │                                      1:1  │  N:1
        ▼                                           ▼
   ┌────────────┐                            ┌──────────┐
   │MercadoPago │                            │ Category │
   │  Payment   │                            └──────────┘
   └────────────┘
        │
   ┌────┴─────────┐
   │ MovimientoMP │
   └──────────────┘

┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐
│  CashClose   │    │CashMovement  │    │ ManualMovement      │
└──────────────┘    └──────────────┘    └─────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐
│   Session    │    │   Setting    │    │ ProductOrderCounter │
└──────────────┘    └──────────────┘    └─────────────────────┘

┌──────────────┐
│ PaymentEvent │
└──────────────┘
```

---

## 📋 Enums Definidos

| Enum | Valores |
|------|---------|
| **Role** | ADMIN, USER |
| **SaleStatus** | PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED |
| **PaymentMethod** | CASH, MP_QR, TRANSFER |
| **PaymentStatus** | PENDING, APPROVED, REJECTED, EXPIRED |
| **MovementType** | ENTRADA, SALIDA |
| **CashMovementType** | INCOME, EXPENSE |

---

## 🗂️ Migraciones Disponibles

- `20240920000000_init` - Migración inicial
- `20240921000000_username_login` - Login con username
- `20240924000000_add_icons_settings` - Configuración de iconos
- `20241005000000_add_category_product_images` - Imágenes de categorías/productos
- `20240930000000_remove_image_url` - Remover image_url
- `20260121000000_add_qr_image_setting` - Configuración QR
- `20260130232246_add_payment_status_and_mp_events` - Estado de pago y eventos MP
- `20260315000000_add_mp_qr_and_sessions` - QR de MP y sesiones
- `20260320000000_add_sale_payment_method_status` - Método de pago y estado
- `20260325000000_add_sale_mp_fields` - Campos adicionales de MP
- `20260501000000_add_lottie_settings` - Configuraciones Lottie
- `20261007000000_add_ticket_settings` - Configuraciones de ticket
- `20261007001000_add_ticket_printed_at` - Fecha de impresión de ticket
- `20261008000000_add_manual_movements` - Movimientos manuales
- `20261009000000_add_cash_closes` - Cierres de caja
- `20261101000000_add_cash_close_and_movements` - Cierre y movimientos
- `20261115000000_add_order_number` - Número de orden
- `20261116000000_add_order_number_to_sale_item` - Número de orden en ítems
- `20261117000000_add_product_order_counter` - Contador de órdenes por producto
- `20260415000000_add_transfer_payment` - Pago por transferencia

---

*Generado automáticamente el 16/04/2026*

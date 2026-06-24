# Modelo de Base de Datos - M-POSW

## Base de Datos: PostgreSQL con Prisma ORM

Archivo schema: `backend/prisma/schema.prisma`

---

## Tablas y Campos

### 1. User (Usuarios)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| username | String (unique) | Nombre de usuario |
| email | String? | Email (opcional) |
| password | String | Contraseña hasheada |
| role | Role (enum) | ADMIN o USER |
| active | Boolean | Usuario activo/inactivo |
| homeModule | String? | Módulo al que redirige post-login |
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
- `1:N` → JournalEntry (asientos contables)
- `1:N` → UserModulePermission (permisos por módulo)

---

### 2. UserModulePermission (Permisos por módulo)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| userId | UUID (FK) | Usuario |
| module | ModuleKey (enum) | Módulo del sistema |
| access | ModuleAccess (enum) | HIDDEN / READ / FULL |

**Relaciones:**
- `N:1` → User

---

### 3. Category (Categorías de productos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| name | String | Nombre de la categoría |
| iconName | String | Nombre del icono |
| colorHex | String | Color en hexadecimal |
| imagePath | String? | Ruta de la imagen |
| imageUpdatedAt | DateTime? | Fecha de actualización de imagen |
| active | Boolean | Activa/inactiva |
| ticket | Boolean | Mostrar en ticket |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Product (productos de la categoría)

---

### 4. Product (Productos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| name | String | Nombre del producto |
| price | Decimal(10,2) | Precio |
| stock | Decimal(10,4) | Stock (default: 0) |
| type | ProductType (enum) | SIMPLE / RAW_MATERIAL / COMPOSITE |
| iconName | String? | Nombre del icono |
| colorHex | String? | Color en hexadecimal |
| imagePath | String? | Ruta de la imagen |
| imageUpdatedAt | DateTime? | Fecha de actualización de imagen |
| active | Boolean | Activo/inactivo |
| categoryId | UUID (FK) | Referencia a Category |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → Category
- `1:N` → SaleItem
- `1:N` → RecipeIngredient (como producto compuesto)
- `1:N` → RecipeIngredient (como materia prima)
- `1:1` → ProductOrderCounter
- `1:1` → InternetPlan

---

### 5. Sale (Ventas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| orderNumber | Int (autoincrement) | Número de orden |
| total | Decimal(10,2) | Total de la venta |
| status | SaleStatus (enum) | PENDING / APPROVED / REJECTED / EXPIRED / CANCELLED |
| paymentStatus | PaymentStatus (enum) | PENDING / APPROVED / REJECTED / EXPIRED |
| paymentMethod | PaymentMethod (enum) | CASH / MP_QR / TRANSFER / FIADO |
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
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → User
- `1:N` → SaleItem
- `1:N` → MercadoPagoPayment
- `1:N` → MovimientoMP
- `1:N` → SaleVoucher (vouchers de internet)

---

### 6. SaleItem (Ítems de venta)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| orderNumber | Int (autoincrement) | Número de orden del ítem |
| saleId | UUID (FK) | Referencia a Sale |
| productId | UUID (FK) | Referencia a Product |
| quantity | Int | Cantidad |
| subtotal | Decimal(10,2) | Subtotal |

**Relaciones:**
- `N:1` → Sale
- `N:1` → Product

---

### 7. CashClose (Cierres de caja)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| from | DateTime | Inicio del período |
| to | DateTime | Fin del período |
| closedAt | DateTime | Fecha de cierre |
| note | String? | Nota opcional |
| closedByUserId | UUID (FK) | Usuario que cerró |
| salesCashTotal | Decimal(10,2) | Total en efectivo |
| salesQrTotal | Decimal(10,2) | Total en QR |
| salesTransferTotal | Decimal(10,2) | Total en transferencia |
| salesTotal | Decimal(10,2) | Total general |
| salesCount | Int | Cantidad de ventas |
| movementsOutTotal | Decimal(10,2) | Total salidas |
| movementsInTotal | Decimal(10,2) | Total entradas |
| movementsNet | Decimal(10,2) | Neto de movimientos |
| netCashDelta | Decimal(10,2) | Delta de efectivo |
| movementsCount | Int | Cantidad de movimientos |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → User

---

### 8. CashMovement (Movimientos de caja)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| type | CashMovementType (enum) | INCOME / EXPENSE |
| amount | Decimal(10,2) | Monto |
| reason | String? | Razón |
| isVoided | Boolean | Anulado |
| createdAt | DateTime | Fecha de creación |
| createdByUserId | UUID (FK) | Usuario que creó |

**Relaciones:**
- `N:1` → User

---

### 9. ManualMovement (Movimientos manuales)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| type | MovementType (enum) | ENTRADA / SALIDA |
| amount | Decimal(10,2) | Monto |
| reason | String | Razón |
| userId | UUID (FK) | Usuario |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → User

---

### 10. Session (Sesiones de usuario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| userId | UUID (FK) | Usuario |
| createdAt | DateTime | Fecha de creación |
| revokedAt | DateTime? | Fecha de revocación |

**Relaciones:**
- `N:1` → User

---

### 11. MercadoPagoPayment (Pagos de MP)

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

### 12. MovimientoMP (Movimientos de MP)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| saleId | UUID? (FK) | Venta asociada |
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

### 13. Setting (Configuración)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| storeName | String | Nombre de la tienda |
| clubName | String | Nombre del club |
| enableTicketPrinting | Boolean | Habilitar impresión de tickets |
| logoUrl | String? | URL del logo |
| faviconUrl | String? | URL del favicon |
| okAnimationUrl | String? | URL de animación OK |
| errorAnimationUrl | String? | URL de animación error |
| accentColor | String? | Color de acento |
| enableCashPayment | Boolean | Habilitar pago en efectivo |
| enableQrPayment | Boolean | Habilitar QR de MP |
| enableTransferPayment | Boolean | Habilitar transferencia |
| enableFiadoPayment | Boolean | Habilitar pago fiado |
| enableSociosModule | Boolean | Habilitar módulo de socios |
| enableTreasuryModule | Boolean | Habilitar módulo de tesorería |
| enableAcreedoresModule | Boolean | Habilitar módulo de acreedores |
| enableInternetModule | Boolean | Habilitar módulo de internet/vouchers |
| enableLigasModule | Boolean | Habilitar módulo de ligas deportivas |
| enablePlayersModule | Boolean | Habilitar módulo de jugadores |
| enablePatrimonioModule | Boolean | Habilitar módulo de patrimonio |
| enableAutoJournalPos | Boolean | Asientos automáticos para ventas POS |
| enableAutoJournalAcreedores | Boolean | Asientos automáticos para pagos acreedores |
| enableAutoJournalSocios | Boolean | Asientos automáticos para pagos socios |
| movementInReasons | String[] | Motivos de entrada |
| movementOutReasons | String[] | Motivos de salida |
| mpAccessToken | String? | Access Token OAuth de MP |
| mpRefreshToken | String? | Refresh Token OAuth de MP |
| mpTokenExpiresAt | DateTime? | Expiración del token OAuth |
| mpCollectorId | String? | Collector ID de MP |
| mpStoreId | String? | Store ID de MP (OAuth) |
| mpPosId | String? | POS ID de MP (OAuth) |
| mpPosName | String? | Nombre del POS (OAuth) |
| mpStoreName | String? | Nombre de la tienda (OAuth) |
| mpExternalPosId | String? | External ID del POS |
| mpExternalStoreId | String? | External ID de la tienda |
| mpQrData | String? | Datos del QR de MP |
| mpLinked | Boolean | Cuenta MP vinculada vía OAuth |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

---

### 14. SocioTipo (Tipos de socio)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| nombre | String (unique) | Nombre del tipo |
| montoMensual | Decimal(10,2) | Monto de la cuota mensual |
| comentario | String? | Comentario opcional |
| activo | Boolean | Activo/inactivo |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Socio
- `1:N` → SocioBeneficio

---

### 15. Socio (Socios del padrón)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| uuid | UUID (unique) | UUID para QR del carnet |
| nroSocio | Int (unique) | Número de socio |
| dni | String | Documento de identidad |
| apellido | String | Apellido |
| nombre | String | Nombre |
| fechaNacimiento | DateTime? | Fecha de nacimiento |
| telefono | String? | Teléfono |
| direccion | String? | Dirección |
| socioTipoId | Int (FK) | Tipo de socio |
| fechaAlta | DateTime | Fecha de alta |
| estado | SocioEstado (enum) | ACTIVO / INACTIVO / SUSPENDIDO |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → SocioTipo
- `1:N` → SocioCuota
- `1:N` → SocioCanje

---

### 16. SocioCuota (Cuotas mensuales)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| socioId | Int (FK) | Socio |
| mes | Int | Mes (1-12) |
| anio | Int | Año |
| montoOriginal | Decimal(10,2) | Monto original de la cuota |
| montoPagado | Decimal(10,2) | Monto pagado acumulado |
| estado | SocioCuotaEstado (enum) | PENDIENTE / PARCIAL / PAGADO |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → Socio
- `1:N` → SocioPago

---

### 17. SocioPago (Pagos de cuotas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| socioCuotaId | Int (FK) | Cuota asociada |
| monto | Decimal(10,2) | Monto del pago |
| fecha | DateTime | Fecha del pago |
| observacion | String? | Observación |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → SocioCuota

---

### 18. SocioBeneficio (Beneficios/descuentos por tipo de socio)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| socioTipoId | Int (FK) | Tipo de socio |
| categoriaProdId | UUID? (FK) | Categoría de producto (opcional) |
| productoId | UUID? (FK) | Producto (opcional) |
| porcentaje | Decimal(5,2) | Porcentaje de descuento |
| descuentoMaximo | Decimal(10,2)? | Tope máximo en $ |
| limiteDiario | Int? | Cantidad de usos por día |
| activo | Boolean | Activo/inactivo |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → SocioTipo
- `N:1` → Category (opcional)
- `N:1` → Product (opcional)
- `1:N` → SocioCanje

---

### 19. SocioCanje (Canjes de beneficios en ventas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| socioBeneficioId | UUID (FK) | Beneficio utilizado |
| socioId | Int (FK) | Socio |
| ventaId | UUID? (FK) | Venta asociada |
| montoDescontado | Decimal(10,2) | Monto del descuento aplicado |
| fecha | DateTime | Fecha del canje |
| usuarioId | UUID | Usuario que realizó el canje |
| posId | String? | ID del POS |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → SocioBeneficio
- `N:1` → Socio

---

### 20. ProductOrderCounter (Contador de órdenes por producto)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| productId | UUID (FK, unique) | Producto |
| lastOrderNumber | Int | Último número de orden |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:1` → Product

---

### 21. LedgerAccount (Plan de cuentas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| code | String (unique) | Código de cuenta (ej: 1.1.1) |
| name | String | Nombre de la cuenta |
| type | LedgerAccountType (enum) | ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE |
| active | Boolean | Cuenta activa/inactiva |
| acceptsEntries | Boolean | Acepta imputaciones (false = agrupadora) |
| parentId | UUID? (FK) | Cuenta padre (jerarquía) |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → LedgerAccount (padre, self-referencing)
- `1:N` → LedgerAccount (hijos)
- `1:N` → JournalEntryLine

---

### 22. JournalEntry (Asientos contables)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| entryNumber | String (unique) | Número de asiento |
| sequenceNumber | Int | Secuencia numérica por año fiscal |
| fiscalYear | Int | Año fiscal |
| month | Int | Mes |
| date | DateTime | Fecha del asiento |
| description | String | Descripción |
| notes | String? | Notas adicionales |
| status | JournalEntryStatus (enum) | DRAFT / POSTED / VOIDED |
| createdById | UUID (FK) | Usuario que creó |
| postedAt | DateTime? | Fecha de contabilización |
| voidedAt | DateTime? | Fecha de anulación |
| voidReason | String? | Motivo de anulación |
| reversalOfId | UUID? (unique, FK) | Asiento original anulado |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → User
- `1:1` → JournalEntry (reversal)
- `1:N` → JournalEntryLine

---

### 23. JournalEntryLine (Líneas de asiento)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| entryId | UUID (FK) | Asiento |
| accountId | UUID (FK) | Cuenta contable |
| debit | Decimal(12,2) | Importe débito |
| credit | Decimal(12,2) | Importe crédito |
| description | String? | Descripción de la línea |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → JournalEntry
- `N:1` → LedgerAccount

---

### 24. PaymentEvent (Eventos de pago externos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| provider | String | Proveedor |
| topic | String | Tópico |
| resourceId | String | ID del recurso |
| createdAt | DateTime | Fecha de creación |

---

### 25. LigasConfig (Torneos asociados — Ligas Deportivas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| nombre | String | Nombre personalizado (menú), opcional |
| leagueId | String | ID de liga en Supabase |
| leagueName | String | Nombre de la liga |
| teamId | String | ID del equipo en Supabase |
| teamName | String | Nombre del equipo |
| active | Boolean | Activo/inactivo |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

---

### 26. InternetPlan (Planes de internet / vouchers WiFi)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| name | String | Nombre del plan |
| duration | Int | Duración en horas |
| idleTimeout | Int | Timeout de inactividad (minutos) |
| downloadBandwidth | String | Ancho de banda de bajada |
| uploadBandwidth | String | Ancho de banda de subida |
| price | Decimal(10,2) | Precio |
| active | Boolean | Activo/inactivo |
| position | Int | Orden de visualización |
| productId | UUID? (FK, unique) | Producto asociado en el POS |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:1` → Product

---

### 27. SaleVoucher (Vouchers vendidos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID (PK) | Identificador único |
| saleId | UUID (FK) | Venta asociada |
| planId | UUID (FK) | Plan de internet |
| pin | String | PIN de acceso único |
| active | Boolean | Voucher activo/usado |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → Sale
- `N:1` → InternetPlan

---

### 28. Acreedor (Acreedores para ventas fiadas)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| nombre | String | Nombre del acreedor |
| telefono | String? | Teléfono |
| notas | String? | Notas |
| activo | Boolean | Activo/inactivo |
| alertaDeuda | Boolean | Alerta de deuda |
| diasSinPagar | Int? | Días sin pagar |
| saldo | Decimal(10,2) | Saldo pendiente |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → FiadoVenta
- `1:N` → PagoAcreedor

---

### 29. FiadoVenta (Ventas fiadas por acreedor)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| acreedorId | Int (FK) | Acreedor |
| ventaId | UUID (FK) | Venta |
| monto | Decimal(10,2) | Monto fiado |
| saldoRestante | Decimal(10,2) | Saldo restante por pagar |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → Acreedor
- `N:1` → Sale

---

### 30. PagoAcreedor (Pagos a acreedores)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| acreedorId | Int (FK) | Acreedor |
| monto | Decimal(10,2) | Monto pagado |
| medioPago | String | Medio de pago |
| fecha | DateTime | Fecha del pago |
| notas | String? | Notas |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → Acreedor

---

### 31. Player (Jugadores)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| firstName | String | Nombre |
| lastName | String | Apellido |
| dni | String? | DNI (opcional) |
| birthDate | DateTime | Fecha de nacimiento |
| sex | Sex (enum) | M / F |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → TournamentPlayer

---

### 32. PlayerCategory (Categorías de jugadores)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| name | String | Nombre de la categoría |
| restrictionType | PlayerCategoryType (enum) | AGE / BIRTH_YEAR |
| ageMin | Int? | Edad mínima (AGE) |
| ageMax | Int? | Edad máxima (AGE) |
| ageCutoffMonth | Int? | Mes de corte (default 12) |
| ageCutoffDay | Int? | Día de corte (default 31) |
| birthYear | Int? | Año de nacimiento (BIRTH_YEAR) |
| active | Boolean | Activa/inactiva |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → TournamentCategory

---

### 33. Tournament (Torneos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| name | String | Nombre del torneo |
| year | Int | Año |
| allowedSex | AllowedSex (enum) | M / F / X (mixto) |
| birthYearMin | Int? | Año nac. mínimo |
| birthYearMax | Int? | Año nac. máximo |
| minPlayers | Int? | Mínimo jugadores (visualización) |
| maxPlayers | Int? | Máximo jugadores (visualización) |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → TournamentCategory
- `1:N` → TournamentPlayer

---

### 34. TournamentCategory (Categorías habilitadas por torneo)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| tournamentId | Int (PK, FK) | Torneo |
| playerCategoryId | Int (PK, FK) | Categoría |

**Relaciones:**
- `N:1` → Tournament
- `N:1` → PlayerCategory

---

### 35. TournamentPlayer (Jugadores fichados en torneos)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| playerId | Int (FK) | Jugador |
| tournamentId | Int (FK) | Torneo |
| playerCategoryId | Int | Categoría asignada |
| fichadoAt | DateTime | Fecha de fichaje |

**Relaciones:**
- `N:1` → Player
- `N:1` → Tournament
- `@@unique([playerId, tournamentId])`

---

### 36. AssetCategory (Categorías de bienes)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| name | String (unique) | Nombre de la categoría |
| isActive | Boolean | Activa/inactiva |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Asset

---

### 37. AssetStatus (Estados de bienes)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| name | String (unique) | Nombre del estado |
| isSystem | Boolean | Es estado del sistema (no editable) |
| isActive | Boolean | Activo/inactivo |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `1:N` → Asset
- `1:N` → AssetEvent

---

### 38. Asset (Bienes registrados)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| name | String | Nombre del bien |
| description | String? | Descripción |
| categoryId | Int (FK) | Categoría |
| statusId | Int (FK) | Estado actual |
| location | String? | Ubicación física |
| acquisitionDate | DateTime? | Fecha de adquisición |
| acquisitionValue | Decimal(12,2)? | Valor de adquisición |
| notes | String? | Notas |
| isActive | Boolean | Activo (false = dado de baja) |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**Relaciones:**
- `N:1` → AssetCategory
- `N:1` → AssetStatus
- `1:N` → AssetEvent

---

### 39. AssetEvent (Historial de eventos del bien)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK, autoincrement) | Identificador único |
| assetId | Int (FK) | Bien |
| eventType | AssetEventType (enum) | ALTA / MODIFICACION / CAMBIO_ESTADO / BAJA |
| statusId | Int? (FK) | Estado resultante del evento |
| description | String? | Descripción del evento |
| eventDate | DateTime | Fecha del evento |
| userId | UUID | Usuario que realizó la acción |
| createdAt | DateTime | Fecha de creación |

**Relaciones:**
- `N:1` → Asset
- `N:1` → AssetStatus

---

## Diagrama de Relaciones

```
┌─────────────────────────────────────────────────────────────────┐
│                            USER                                 │
├─────────────────────────────────────────────────────────────────┤
│  1:N → Sales, CashCloses, CashMovements, Sessions,              │
│        ManualMovements, JournalEntries, UserModulePermission    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐         ┌──────────┐         ┌─────────────┐
   │  Sale   │◄──1:N───┤ SaleItem │───N:1──►│   Product   │
   └────┬────┘         └──────────┘         └──────┬──────┘
        │                              1:N  │  N:1
        │ 1:N            ┌─────────┐   1:1   ▼
        ├───────────────►│SaleVouch│◄──────┐
        │                │   er    │       │  ┌──────────┐
        │                └─────────┘  N:1  │  │ Category │
        │                     │  InternetPlan└──────────┘
        ▼                     │
   ┌────────────┐             │
   │MercadoPago │             │
   │  Payment   │             │
   └────────────┘             │
        │                     │
   ┌────┴─────────┐           │
   │ MovimientoMP │           │
   └──────────────┘           │
                              │
   ┌──────────────────────────┼───────────────────────────┐
   │                     FIADO / ACREEDORES               │
   │  ┌──────────┐     ┌────────────┐    ┌─────────────┐ │
   │  │ Acreedor │◄1:N─┤ FiadoVenta │───►│    Sale     │ │
   │  └────┬─────┘     └────────────┘    └─────────────┘ │
   │       │ 1:N                                          │
   │       ▼                                              │
   │  ┌─────────────┐                                     │
   │  │ PagoAcreedor│                                     │
   │  └─────────────┘                                     │
   └──────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐
│  CashClose   │    │CashMovement  │    │ ManualMovement      │
└──────────────┘    └──────────────┘    └─────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐
│   Session    │    │   Setting    │    │ ProductOrderCounter │
└──────────────┘    └──────────────┘    └─────────────────────┘

┌──────────────┐    ┌────────────────────┐
│ PaymentEvent │    │UserModulePermission│
└──────────────┘    └────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     SOCIOS / PADRÓN                            │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────┐     ┌───────────┐     ┌───────────┐          │
│  │ SocioTipo │◄1:N─│   Socio   │◄1:N─│SocioCuota │◄1:N────►│
│  └─────┬─────┘     └─────┬─────┘     └───────────┘          │
│        │                 │                       │           │
│        │                 │                  ┌────┴─────┐     │
│        │                 │                  │SocioPago │     │
│        │ N:1            N:1                └──────────┘     │
│        ▼                 ▼                                   │
│  ┌──────────────┐  ┌───────────┐                             │
│  │SocioBeneficio│  │SocioCanje │─────────────────► Sale     │
│  └──┬────┬──────┘  └───────────┘                             │
│     │    │                                                    │
│     ▼    ▼                                                    │
│  Category Product                                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  TESORERÍA / PARTIDA DOBLE                    │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────┐         ┌─────────────────┐              │
│  │ LedgerAccount │◄─1:N────│JournalEntryLine │───N:1────────►│
│  │ (plan cuentas)│         └────────┬────────┘              │
│  │   jerárquico  │                  │                        │
│  └───────┬───────┘                  │                        │
│          │ self-ref                  │                        │
│          └──────────────────────────┘                        │
│  ┌──────────────┐         ┌─────────────────┐              │
│  │ JournalEntry │◄─1:1────│ JournalEntry    │              │
│  │  (asiento)   │         │ (reversión)     │              │
│  └──────────────┘         └─────────────────┘              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     JUGADORES / PLAYERS                       │
├──────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ Player │◄1:N─TournamentPlayer─N:1►│    Tournament     │ │
│  └────────┘  └──────────────────┘  └──────────┬───────────┘ │
│                                               │              │
│  ┌────────────────┐                   ┌──────┴──────────┐   │
│  │ PlayerCategory │◄──────N:N─────────┤TournamentCategory│  │
│  └────────────────┘                   └─────────────────┘   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    PATRIMONIO / BIENES                        │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────┐     ┌───────────┐     ┌────────────┐    │
│  │ AssetCategory │◄1:N─│   Asset   │◄1:N─│ AssetEvent │    │
│  └───────────────┘     └─────┬─────┘     └──────┬─────┘    │
│                              │ N:1              │ N:1       │
│                              ▼                  ▼           │
│                       ┌────────────┐   ┌────────────┐      │
│                       │AssetStatus │   │AssetStatus │      │
│                       └────────────┘   └────────────┘      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      LIGAS DEPORTIVAS                         │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                            │
│  │ LigasConfig │  (datos locales de seguimiento)            │
│  └─────────────┘                                            │
│                                                              │
│  Datos remotos (Supabase): leagues, categories, teams,      │
│  matches — consultados vía REST, no almacenados localmente  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   INTERNET / VOUCHERS WiFi                    │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌─────────────┐                       │
│  │ InternetPlan │◄1:N─│ SaleVoucher │────N:1──► Sale       │
│  └──────┬───────┘     └─────────────┘                       │
│         │ 1:1                                                │
│         ▼                                                    │
│  ┌─────────┐                                                 │
│  │ Product │  (producto en el POS)                           │
│  └─────────┘                                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Enums Definidos

| Enum | Valores |
|------|---------|
| **Role** | ADMIN, USER |
| **ModuleKey** | POS, VENTAS, SOCIOS, TESORERIA, ACREEDORES, PRODUCTOS, INTERNET, LIGAS, PLAYERS, REPORTES, CONFIGURACION, PATRIMONIO |
| **ModuleAccess** | HIDDEN, READ, FULL |
| **SaleStatus** | PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED |
| **PaymentMethod** | CASH, MP_QR, TRANSFER, FIADO |
| **PaymentStatus** | PENDING, APPROVED, REJECTED, EXPIRED |
| **SocioEstado** | ACTIVO, INACTIVO, SUSPENDIDO |
| **SocioCuotaEstado** | PENDIENTE, PARCIAL, PAGADO |
| **MovementType** | ENTRADA, SALIDA |
| **AccountingMovementType** | INCOME, EXPENSE |
| **ProductType** | SIMPLE, RAW_MATERIAL, COMPOSITE |
| **CashMovementType** | INCOME, EXPENSE |
| **LedgerAccountType** | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| **JournalEntryStatus** | DRAFT, POSTED, VOIDED |
| **AssetEventType** | ALTA, MODIFICACION, CAMBIO_ESTADO, BAJA |
| **Sex** | M, F |
| **AllowedSex** | M, F, X |
| **PlayerCategoryType** | AGE, BIRTH_YEAR |

---

## Migraciones

<details>
<summary>Listado completo de migraciones (click para expandir)</summary>

| Migración | Descripción |
|-----------|-------------|
| `20240920000000_init` | Migración inicial |
| `20240921000000_username_login` | Login con username |
| `20240924000000_add_icons_settings` | Configuración de iconos |
| `20240930000000_remove_image_url` | Remover image_url |
| `20241005000000_add_category_product_images` | Imágenes categorías/productos |
| `20260121000000_add_qr_image_setting` | Configuración QR |
| `20260130232246_add_payment_status_and_mp_events` | Estado de pago y eventos MP |
| `20260315000000_add_mp_qr_and_sessions` | QR MP y sesiones |
| `20260320000000_add_sale_payment_method_status` | Método de pago y estado en ventas |
| `20260325000000_add_sale_mp_fields` | Campos adicionales MP |
| `20260415000000_add_transfer_payment` | Pago por transferencia |
| `20260416110022_add_product_stock` | Stock de productos |
| `20260501000000_add_lottie_settings` | Configuraciones Lottie |
| `20260526230550_add_mp_oauth` | OAuth Mercado Pago |
| `20260527002828_add_mp_collector_id` | Collector ID MP |
| `20260527003957_add_mp_pos_setup` | Configuración POS MP |
| `20260528115000_fix_product_stock_decimal` | Fix stock decimal |
| `20260528122000_add_mp_external_ids` | IDs externos MP |
| `20261007000000_add_ticket_settings` | Configuración de tickets |
| `20261007001000_add_ticket_printed_at` | Fecha impresión ticket |
| `20261008000000_add_manual_movements` | Movimientos manuales |
| `20261101000000_add_cash_close_and_movements` | Cierre de caja y movimientos |
| `20261115000000_add_order_number` | Número de orden |
| `20261116000000_add_order_number_to_sale_item` | Número de orden en ítems |
| `20261117000000_add_product_order_counter` | Contador de órdenes |
| `20261201000000_add_accounting_module` | Módulo contable |
| `20261202000000_add_missing_columns` | Columnas faltantes |
| `20261203000000_add_ledger_module` | Plan de cuentas y asientos |
| `20261205000000_add_fiado_module` | Módulo de acreedores/fiado |
| `20261206000000_integracion_contable` | Integración contable |
| `20261207000000_add_auto_journal_toggles` | Toggles de asientos automáticos |
| `20261217000000_add_username_and_permissions` | Rename name→username, ModuleKey/ModuleAccess, UserModulePermission |
| `20261217010000_add_ventas_productos_modules` | Módulos VENTAS y PRODUCTOS |
| `20261223000000_add_players_module` | Módulo de jugadores (Player, PlayerCategory, Tournament, etc.) |
| `20261224000000_player_dni_optional_category_active` | DNI opcional + active en categorías |
| `20261224000001_tournament_min_max_players` | minPlayers/maxPlayers en torneos |
| `20260601000000_add_mp_city_mappings` | Mapeo de ciudades MP |
| `20260601000001_seed_mp_city_mappings` | Seed de ciudades MP |
| `20260609181037_add_socios_models` | Módulo de socios |
| `20260610115347_add_socio_uuid` | UUID en Socio |
| `20260610150000_add_socios_beneficios` | Beneficios de socios |
| `20260610150100_add_beneficio_producto` | FK producto en beneficios |
| `20260610153700_add_module_toggles` | Toggles de módulos en Setting |
| `20260612000000_add_internet_plans` | Planes de internet y vouchers |
| `20260618160421_add_ligas_module` | Ligas deportivas (LigasConfig) |
| `20260624131942_add_patrimonio_module` | Módulo de patrimonio (Asset, AssetCategory, etc.) |
| `20260624142350_add_nombre_to_ligas_config` | Campo nombre en LigasConfig |

</details>

---

*Actualizado el 24/06/2026*

# Confirmación de Pagos por Transferencia - MercadoPago

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Endpoints de la API](#endpoints-de-la-api)
4. [DTOs (Data Transfer Objects)](#dtos-data-transfer-objects)
5. [Flujo de Trabajo](#flujo-de-trabajo)
6. [Referencia Técnica de la API MercadoPago](#referencia-técnica-de-la-api-mercadopago)
   - [URL del Endpoint](#url-del-endpoint)
   - [Headers Requeridos](#headers-requeridos)
   - [Query Parameters](#query-parameters-argumentos)
   - [Estructura de la Respuesta](#estructura-de-la-respuesta)
   - [Identificación de Transferencias](#identificación-de-transferencias-entrantes)
7. [Configuración y Requerimientos](#configuración-y-requerimientos)
8. [Implementación del Servicio](#implementación-del-servicio)
9. [Base de Datos](#base-de-datos)
10. [Integración con Webhooks](#integración-con-webhooks)
11. [Manejo de Errores](#manejo-de-errores)
12. [Seguridad](#seguridad)
13. [Consideraciones Importantes](#consideraciones-importantes)

---

## Visión General

El sistema de confirmación de pagos por transferencia permite a los usuarios verificar pagos realizados mediante transferencias bancarias a través de CVU (Clave Virtual Uniforme) de MercadoPago. Este módulo consulta periódicamente la API de MercadoPago para detectar pagos entrantes y confirmarlos automáticamente.

### Características Principales
- **Polling automático**: Consulta cada 2 minutos los pagos recientes
- **Detección de transferencias**: Filtra pagos por método `cvu` o tipo de operación `money_transfer`
- **Prevención de duplicados**: Sistema de caché y base de datos para evitar procesar el mismo pago dos veces
- **Validación de montos**: Verifica que el monto recibido coincida con el esperado

---

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    Payments Module                         │
├─────────────────────────────────────────────────────────────┤
│  PaymentsController                                          │
│  ├── POST /payments/poll-transfer                           │
│  └── POST /payments/confirm-transfer                        │
├─────────────────────────────────────────────────────────────┤
│  PaymentsService                                             │
│  ├── pollTransfer(montoEsperado, userId)                    │
│  └── confirmTransfer(paymentId, montoRecibido, ...)         │
├─────────────────────────────────────────────────────────────┤
│  MercadoPagoQueryService (sales module)                    │
│  ├── getPayment(paymentId)                                  │
│  └── searchPaymentsByExternalReference(externalRef)         │
└─────────────────────────────────────────────────────────────┘
```

### Ubicación de Archivos
```
backend/
├── src/
│   └── modules/
│       ├── payments/
│       │   ├── payments.controller.ts
│       │   ├── payments.service.ts
│       │   ├── payments.module.ts
│       │   └── dto/
│       │       └── transfer.dto.ts
│       └── sales/
│           ├── services/
│           │   ├── mercadopago-query.service.ts
│           │   └── mercadopago-webhook-processor.service.ts
│           └── webhooks/
│               └── mercadopago-webhook.controller.ts
└── prisma/
    └── schema.prisma
```

---

## Endpoints de la API

### 1. Poll Transfer (Consultar Transferencias)

**URL:** `POST /payments/poll-transfer`

**Headers Requeridos:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Roles Permitidos:** `ADMIN`, `USER`

**Request Body:**
```json
{
  "monto_esperado": 1500.00
}
```

**Response Body (Success):**
```json
{
  "hay_pago": true,
  "monto": 1500.00,
  "pagador": "Juan Pérez",
  "tipo": "cvu",
  "fecha": "2024-01-15T14:30:00.000Z",
  "payment_id": "1234567890"
}
```

**Response Body (No Payment):**
```json
{
  "hay_pago": false
}
```

---

### 2. Confirm Transfer (Confirmar Transferencia)

**URL:** `POST /payments/confirm-transfer`

**Headers Requeridos:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Roles Permitidos:** `ADMIN`, `USER`

**Request Body:**
```json
{
  "payment_id": "1234567890",
  "monto_recibido": 1500.00,
  "monto_esperado": 1500.00,
  "items": [
    {
      "productId": "uuid-del-producto",
      "quantity": 2
    }
  ]
}
```

**Response Body (Success):**
```json
{
  "success": true,
  "saleId": "uuid-de-la-venta",
  "orderNumber": 42,
  "message": "Pago ya procesado"
}
```

**Response Body (Error):**
```json
{
  "success": false,
  "message": "Producto inválido o inactivo"
}
```

---

## DTOs (Data Transfer Objects)

### PollTransferDto
```typescript
class PollTransferDto {
  monto_esperado: number  // Mínimo: > 0, Max 2 decimales
}
```

### ConfirmTransferDto
```typescript
class ConfirmTransferDto {
  payment_id: string      // ID del pago en MercadoPago
  monto_recibido: number // Mínimo: > 0, Max 2 decimales
  monto_esperado: number // Mínimo: > 0, Max 2 decimales
}
```

### Interfaces de Respuesta

```typescript
interface PollTransferResponse {
  hay_pago: boolean;     // Indica si se encontró un pago
  monto?: number;         // Monto del pago
  pagador?: string;       // Nombre del pagador
  tipo?: string;          // 'cvu' o 'transferencia'
  fecha?: string;         // Fecha ISO del pago
  payment_id?: string;    // ID del pago en MercadoPago
}

interface ConfirmTransferResponse {
  success: boolean;       // Éxito de la operación
  saleId?: string;       // UUID de la venta creada
  orderNumber?: number;  // Número de orden
  message?: string;      // Mensaje adicional
}
```

---

## Flujo de Trabajo

### Diagrama de Secuencia

```
┌─────────┐         ┌──────────────┐         ┌────────────────┐
│ Cliente │         │ API Backend  │         │ MercadoPago    │
└────┬────┘         └──────┬───────┘         └────────────────┘
     │                     │                          │
     │ 1. POST /poll-transfer                      │
     │    (monto_esperado) │                          │
     │────────────────────>│                          │
     │                     │ 2. GET /v1/payments/search│
     │                     │    (últimos 2 minutos)   │
     │                     │─────────────────────────>│
     │                     │                          │
     │                     │ 3. Respuesta con pagos  │
     │                     │<─────────────────────────│
     │                     │                          │
     │                     │ 4. Filtrar por CVU/      │
     │                     │    transferencias        │
     │                     │                          │
     │ 5. Respuesta con    │                          │
     │    datos del pago   │                          │
     │<────────────────────│                          │
     │                     │                          │
     │ 6. POST /confirm-transfer                   │
     │    (payment_id,    │                          │
     │     monto, items)   │                          │
     │────────────────────>│                          │
     │                     │ 7. Validar en DB         │
     │                     │    (no duplicado)          │
     │                     │                          │
     │                     │ 8. Crear Sale +          │
     │                     │    MovimientoMP          │
     │                     │                          │
     │ 9. Respuesta éxito  │                          │
     │<────────────────────│                          │
```

### Paso a Paso

1. **Cliente** envía solicitud `POST /poll-transfer` con el monto esperado
2. **Backend** consulta la API de MercadoPago `/v1/payments/search`
3. **Backend** filtra resultados por:
   - `payment_method_id === 'cvu'` OR `operation_type === 'money_transfer'`
   - `status === 'approved'`
   - Últimos 2 minutos
4. **Backend** verifica que el pago no esté ya procesado (caché + DB)
5. **Backend** retorna información del pago encontrado
6. **Cliente** confirma con `POST /confirm-transfer`
7. **Backend** verifica duplicados en tabla `MovimientoMP`
8. **Backend** crea la venta (`Sale`) y registra el movimiento (`MovimientoMP`)
9. **Backend** retorna confirmación

---

## Referencia Técnica de la API MercadoPago

> **Nota:** Esta sección es una referencia técnica detallada para implementar la solución en otros proyectos.

### URL del Endpoint

```
GET https://api.mercadopago.com/v1/payments/search
```

**Base URL:** `https://api.mercadopago.com`  
**Path:** `/v1/payments/search`  
**Método:** `GET`  
**Autenticación:** Bearer Token en header `Authorization`

---

### Headers Requeridos

```http
Authorization: Bearer {MP_ACCESS_TOKEN}
Content-Type: application/json
```

El token debe tener el formato `APP_USR-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` y puede obtenerse desde el panel de desarrolladores de MercadoPago.

---

### Query Parameters (Argumentos)

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `range` | string | Sí | Campo de fecha para filtrar | `date_created` |
| `begin_date` | ISO 8601 | Sí | Fecha/hora inicio (UTC) | `2024-01-15T12:00:00.000Z` |
| `end_date` | ISO 8601 | Sí | Fecha/hora fin (UTC) | `2024-01-15T12:02:00.000Z` |
| `sort` | string | No | Campo de ordenamiento | `date_created` |
| `criteria` | string | No | Dirección de orden (desc/asc) | `desc` |
| `limit` | integer | No | Máximo de resultados | `10` (máx: 100) |
| `status` | string | Sí | Estado del pago | `approved` |
| `external_reference` | string | No | Referencia externa asignada | `sale_123` |

#### Ejemplo de URL Completa

```
https://api.mercadopago.com/v1/payments/search?range=date_created&begin_date=2024-01-15T12:00:00.000Z&end_date=2024-01-15T12:02:00.000Z&sort=date_created&criteria=desc&limit=10&status=approved
```

#### Cálculo de Fechas (Implementación de Referencia)

```typescript
// Calcular rango de tiempo (últimos 2 minutos)
const now = new Date();
const beginDate = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutos atrás

const beginDateISO = beginDate.toISOString();
const endDateISO = now.toISOString();
```

---

### Estructura de la Respuesta

La API de MercadoPago devuelve un objeto JSON con la siguiente estructura:

```json
{
  "paging": {
    "total": 1,
    "limit": 10,
    "offset": 0
  },
  "results": [
    {
      "id": 1234567890,
      "date_created": "2024-01-15T12:01:30.000-03:00",
      "date_approved": "2024-01-15T12:01:35.000-03:00",
      "date_last_updated": "2024-01-15T12:01:35.000-03:00",
      "money_release_date": "2024-01-15T12:01:35.000-03:00",
      "payment_method_id": "cvu",
      "payment_type_id": "bank_transfer",
      "operation_type": "money_transfer",
      "status": "approved",
      "status_detail": "accredited",
      "transaction_amount": 1500.00,
      "transaction_amount_refunded": 0,
      "currency_id": "ARS",
      "description": "Transferencia recibida",
      "external_reference": null,
      "payer": {
        "id": 987654321,
        "email": "cliente@email.com",
        "identification": {
          "type": "DNI",
          "number": "12345678"
        },
        "type": "customer",
        "first_name": "Juan",
        "last_name": "Pérez"
      },
      "collector": {
        "id": 111111111,
        "email": "tu-cuenta@email.com",
        "nickname": "TU_NICKNAME"
      },
      "fee_details": [],
      "statement_descriptor": "MERCADOPAGO",
      " installments": 1,
      "card": {},
      "point_of_interaction": {
        "type": "CVU"
      }
    }
  ]
}
```

#### Campos Principales de la Respuesta

| Campo | Tipo | Descripción | Uso para Transferencias |
|-------|------|-------------|------------------------|
| `results` | array | Lista de pagos encontrados | Contenedor principal |
| `results[].id` | string/number | ID único del pago | **Importante:** Usar como `payment_id` |
| `results[].status` | string | Estado del pago | Verificar que sea `"approved"` |
| `results[].payment_method_id` | string | Método de pago | **Filtrar por:** `"cvu"` |
| `results[].operation_type` | string | Tipo de operación | **Filtrar por:** `"money_transfer"` |
| `results[].transaction_amount` | number | Monto recibido | Comparar con monto esperado |
| `results[].date_created` | string | Fecha de creación | ISO 8601 con timezone |
| `results[].date_approved` | string | Fecha de aprobación | Puede ser null si no está aprobado |
| `results[].payer` | object | Datos del pagador | Extraer nombre/email |
| `results[].payer.first_name` | string | Nombre | Concatenar para mostrar pagador |
| `results[].payer.last_name` | string | Apellido | Concatenar para mostrar pagador |
| `results[].payer.email` | string | Email del pagador | Fallback si no hay nombre |
| `results[].currency_id` | string | Moneda | Verificar `"ARS"` para Argentina |
| `results[].status_detail` | string | Detalle del estado | `"accredited"` indique acreditado |

---

### Identificación de Transferencias Entrantes

Para determinar si un pago es una **transferencia entrante** (CVU), se deben verificar estos campos:

#### 1. Método de Pago (`payment_method_id`)

```typescript
const isTransferByMethod = payment.payment_method_id === 'cvu';
// Retorna: true para transferencias por CVU
```

Valores posibles:
- `"cvu"` - Transferencia por CVU (Clave Virtual Uniforme)
- `"account_money"` - Dinero en cuenta de MercadoPago
- `"debit_card"` - Tarjeta de débito
- `"credit_card"` - Tarjeta de crédito
- `"ticket"` - Efectivo (Rapipago, Pago Fácil, etc.)

#### 2. Tipo de Operación (`operation_type`)

```typescript
const isTransferByOperation = payment.operation_type === 'money_transfer';
// Retorna: true para transferencias de dinero
```

Valores posibles:
- `"money_transfer"` - Transferencia de dinero entre cuentas
- `"regular_payment"` - Pago regular de compra
- `"recurring_payment"` - Pago recurrente (suscripción)
- `"account_fund"` - Fondeo de cuenta
- `"payment_addition"` - Adición a pago existente

#### 3. Filtro Combinado (Implementación de Referencia)

```typescript
const isTransfer = 
  payment.payment_method_id === 'cvu' || 
  payment.operation_type === 'money_transfer';
```

**Importante:** Se usa OR (||) porque algunas transferencias pueden tener `payment_method_id: "account_money"` pero `operation_type: "money_transfer"`.

#### 4. Estado del Pago (`status`)

```typescript
const isApproved = payment.status === 'approved';
// Solo procesar pagos aprobados
```

Estados posibles:
- `"approved"` - Pago acreditado y aprobado
- `"pending"` - Pago pendiente de procesamiento
- `"in_process"` - Pago en proceso
- `"rejected"` - Pago rechazado
- `"cancelled"` - Pago cancelado
- `"refunded"` - Pago reembolsado
- `"charged_back"` - Contracargo

#### 5. Detalle del Estado (`status_detail`)

```typescript
const isAccredited = payment.status_detail === 'accredited';
// Indica que el dinero ya fue acreditado en la cuenta
```

---

### Código de Ejemplo: Parsing de Respuesta

```typescript
interface MPPayment {
  id: string | number;
  status: string;
  transaction_amount: number;
  payment_method_id?: string;
  operation_type?: string;
  date_created?: string;
  date_approved?: string;
  payer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  currency_id?: string;
  status_detail?: string;
}

interface MPResponse {
  results?: MPPayment[];
  paging?: {
    total: number;
    limit: number;
    offset: number;
  };
}

// Función para identificar transferencias
function identifyTransfer(payment: MPPayment): boolean {
  // Verificar método CVU o operación money_transfer
  const isTransferMethod = payment.payment_method_id === 'cvu';
  const isTransferOperation = payment.operation_type === 'money_transfer';
  
  // Verificar estado aprobado
  const isApproved = payment.status === 'approved';
  
  return (isTransferMethod || isTransferOperation) && isApproved;
}

// Función para extraer información del pagador
function extractPayerInfo(payment: MPPayment): string {
  if (!payment.payer) return 'Desconocido';
  
  const firstName = payment.payer.first_name || '';
  const lastName = payment.payer.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  return fullName || payment.payer.email || 'Desconocido';
}

// Procesar respuesta de MercadoPago
function processPayments(response: MPResponse): TransferInfo[] {
  const payments = response.results || [];
  
  return payments
    .filter(identifyTransfer)
    .map(payment => ({
      payment_id: String(payment.id),
      monto: payment.transaction_amount,
      pagador: extractPayerInfo(payment),
      tipo: payment.payment_method_id === 'cvu' ? 'cvu' : 'transferencia',
      fecha: payment.date_approved || payment.date_created,
      status: payment.status,
      currency: payment.currency_id
    }));
}
```

---

### Códigos de Error de la API

| Código HTTP | Significado | Causa Común | Solución |
|-------------|-------------|-------------|----------|
| `200` | OK | Respuesta exitosa | Procesar results |
| `400` | Bad Request | Parámetros inválidos | Verificar query params |
| `401` | Unauthorized | Token inválido | Verificar MP_ACCESS_TOKEN |
| `403` | Forbidden | Sin permisos | Token sin scope necesario |
| `404` | Not Found | Endpoint incorrecto | Verificar URL |
| `429` | Too Many Requests | Rate limit excedido | Implementar backoff |
| `500` | Internal Server Error | Error de MP | Reintentar más tarde |
| `502` | Bad Gateway | Error de conexión | Verificar conectividad |
| `503` | Service Unavailable | MP en mantenimiento | Esperar y reintentar |
| `504` | Gateway Timeout | Timeout de API | Aumentar timeout o reintentar |

---

### Rate Limiting y Mejores Prácticas

MercadoPago implementa rate limiting en sus APIs. Recomendaciones:

1. **Frecuencia de polling:** No más de 1 vez por minuto por usuario
2. **Ventana de tiempo:** Limitar a 2-5 minutos atrás (evita procesar pagos viejos)
3. **Timeout:** Configurar timeout de 8-10 segundos
4. **Retry:** Implementar retry con backoff exponencial (3s, 10s, 20s)
5. **Caché local:** Mantener caché de payment_ids ya vistos
6. **Deduplicación:** Verificar en base de datos antes de procesar

---

## Configuración y Requerimientos

### Variables de Entorno

| Variable | Descripción | Requerido | Ejemplo |
|----------|-------------|-----------|---------|
| `MP_ACCESS_TOKEN` | Token de acceso a la API de MercadoPago | Sí | `APP_USR-123456...` |
| `MP_WEBHOOK_SECRET` | Secret para validar webhooks | Opcional | `whsec_...` |
| `MP_WEBHOOK_STRICT_PAYMENT` | Validación estricta de webhooks | No | `true` o `false` |

### URLs de MercadoPago API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `https://api.mercadopago.com/v1/payments/search` | GET | Buscar pagos con filtros |
| `https://api.mercadopago.com/v1/payments/{id}` | GET | Obtener pago específico |
| `https://api.mercadopago.com/merchant_orders/{id}` | GET | Obtener orden de comerciante |

### Parámetros de Búsqueda (Query Params)

```
range=date_created
begin_date=2024-01-15T12:00:00.000Z
end_date=2024-01-15T12:02:00.000Z
sort=date_created
criteria=desc
limit=10
status=approved
```

---

## Implementación del Servicio

### PaymentsService

El servicio principal maneja la lógica de negocio para la confirmación de transferencias.

#### Métodos Principales

```typescript
@Injectable()
export class PaymentsService {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly timeoutMs = 8000;
  private readonly seenPaymentIds = new Set<string>();

  // Consultar transferencias pendientes
  async pollTransfer(
    montoEsperado: number, 
    userId: string
  ): Promise<PollTransferResponse>

  // Confirmar y procesar una transferencia
  async confirmTransfer(
    paymentId: string,
    montoRecibido: number,
    montoEsperado: number,
    userId: string,
    items: { productId: string; quantity: number }[],
  ): Promise<ConfirmTransferResponse>

  // Limpiar caché de IDs vistos
  clearSeenPayments(): void
}
```

### Filtrado de Pagos

```typescript
const transferPayments = payments.filter((payment) => {
  // Solo transferencias CVU o money_transfer
  const isTransfer = 
    payment.payment_method_id === 'cvu' || 
    payment.operation_type === 'money_transfer';
  
  if (!isTransfer) return false;
  
  // Saltar pagos ya procesados en esta sesión
  const paymentId = String(payment.id);
  if (this.seenPaymentIds.has(paymentId)) return false;
  
  return true;
});
```

---

## Base de Datos

### Modelo MovimientoMP

```prisma
model MovimientoMP {
  id            String   @id @default(uuid()) @db.Uuid
  saleId        String?  @db.Uuid
  sale          Sale?    @relation(fields: [saleId], references: [id], onDelete: SetNull)
  paymentId     String   @unique
  monto         Decimal  @db.Decimal(10, 2)
  montoEsperado Decimal  @db.Decimal(10, 2)
  pagador       String?
  tipo          String?
  fecha         DateTime
  notificado    Boolean  @default(false)
  procesado     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([saleId])
  @@index([paymentId])
  @@index([notificado])
  @@index([createdAt])
}
```

### Modelo Sale (Relacionado)

```prisma
model Sale {
  id              String     @id @default(uuid()) @db.Uuid
  orderNumber     Int        @default(autoincrement())
  total           Decimal    @db.Decimal(10, 2)
  status          SaleStatus @default(PENDING)
  paymentStatus   PaymentStatus @default(PENDING)
  paymentMethod   PaymentMethod
  cashReceived    Decimal?   @db.Decimal(10, 2)
  changeAmount    Decimal?   @db.Decimal(10, 2)
  mpPaymentId     String?
  mpMerchantOrderId String?
  mpStatus        String?
  mpStatusDetail  String?
  mpRaw           Json?
  
  items           SaleItem[]
  movimientosMP   MovimientoMP[]
  // ... otros campos
}
```

### Enum PaymentMethod

```prisma
enum PaymentMethod {
  CASH
  MP_QR
  TRANSFER
}
```

---

## Integración con Webhooks

### Flujo Webhook (Complementario)

Además del polling manual, el sistema puede recibir notificaciones push de MercadoPago:

**Endpoint:** `POST /webhooks/mercadopago`

**Tópicos Soportados:**
- `payment` - Notificación de cambio en pago
- `merchant_order` - Notificación de orden de comerciante

**Headers de Validación:**
```http
x-signature: v1=hash;ts=timestamp
x-request-id: uuid
```

### Proceso de Webhook

1. Recibe notificación de MercadoPago
2. Valida firma (si `MP_WEBHOOK_SECRET` está configurado)
3. Consulta detalles del pago/orden
4. Actualiza estado de la venta
5. Notifica a clientes conectados vía WebSocket

---

## Manejo de Errores

### Códigos de Error Comunes

| Escenario | Error | HTTP Status |
|-----------|-------|-------------|
| Token no configurado | `MP_ACCESS_TOKEN no configurado` | 500 |
| Timeout de API | `Timeout consultando MercadoPago` | 504 |
| Producto inválido | `Producto inválido o inactivo` | 400 |
| Pago ya procesado | Retorna success=true con datos existentes | 200 |
| Error de API MP | `MercadoPago API error: {status}` | 502 |

### Retry Automático

El webhook processor tiene retry automático para casos donde la orden llega antes que el pago:

```typescript
private readonly paymentRetryDelaysMs = [3000, 10000, 20000];
```

---

## Seguridad

### Autenticación

- **JWT Bearer Token** requerido en todos los endpoints
- Roles `ADMIN` y `USER` permitidos
- Guarde implementadas: `JwtAuthGuard`, `RolesGuard`

### Validación de Firmas Webhook

```typescript
verifySignature({ headers }, manifestId, secret)
```

Valida que las notificaciones provengan realmente de MercadoPago usando HMAC-SHA256.

### Prevención de Duplicados

1. **Caché en memoria:** `seenPaymentIds: Set<string>`
2. **Base de datos:** Índice único en `MovimientoMP.paymentId`
3. **Idempotencia:** Tabla `PaymentEvent` con combinación única `(provider, topic, resourceId)`

---

## Consideraciones Importantes

### Límites y Timeouts

- **Timeout de API MP:** 8000ms (8 segundos)
- **Ventana de búsqueda:** Últimos 2 minutos
- **Límite de resultados:** 10 pagos por consulta
- **Retry delays:** 3s, 10s, 20s (para webhooks)

### Formatos de Monto

- Siempre usar máximo 2 decimales
- Redondeo: `Math.round(monto * 100) / 100`
- Tipo de dato en DB: `Decimal(10, 2)`

### Estados de Pago

```typescript
enum PaymentStatus {
  PENDING   // Pendiente
  APPROVED  // Aprobado
  REJECTED  // Rechazado
  EXPIRED   // Expirado
}
```

### Métodos de Pago Soportados

- `cvu` - Transferencia por CVU
- `money_transfer` - Transferencia de dinero

---

## Ejemplos de Uso

### Ejemplo Completo: Polling y Confirmación

```typescript
// 1. Consultar pagos
const pollResponse = await fetch('/payments/poll-transfer', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <JWT>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ monto_esperado: 1500.00 })
});

const pollData = await pollResponse.json();

if (pollData.hay_pago) {
  console.log(`Pago recibido de ${pollData.pagador}: $${pollData.monto}`);
  
  // 2. Confirmar el pago
  const confirmResponse = await fetch('/payments/confirm-transfer', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <JWT>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payment_id: pollData.payment_id,
      monto_recibido: pollData.monto,
      monto_esperado: 1500.00,
      items: [
        { productId: 'uuid-1', quantity: 2 },
        { productId: 'uuid-2', quantity: 1 }
      ]
    })
  });
  
  const confirmData = await confirmResponse.json();
  
  if (confirmData.success) {
    console.log(`Venta #${confirmData.orderNumber} creada exitosamente`);
  }
}
```

---

## Documentación Adicional

Para más información sobre la API de MercadoPago:
- [Documentación Oficial](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/landing)
- [Referencia de API](https://www.mercadopago.com.ar/developers/es/reference)
- [Credenciales y Tokens](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials)

---

## Changelog

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2026-04-17 | 1.1.0 | Agregada referencia técnica completa de la API MercadoPago para re-implementación |
| 2024-01 | 1.0.0 | Implementación inicial del sistema de confirmación de transferencias |

---

*Documento generado automáticamente basado en la implementación del proyecto.*

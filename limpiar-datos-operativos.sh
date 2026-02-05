#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_PATH="$ROOT_DIR/backend/prisma/schema.prisma"

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "No se encontró el schema de Prisma en: $SCHEMA_PATH" >&2
  exit 1
fi

if [[ "${1:-}" != "--yes" ]]; then
  cat <<'MSG'
Este script ELIMINA datos operativos de la base de datos:
- Ventas (Sale, SaleItem, MercadoPagoPayment)
- Ingresos/Egresos manuales (ManualMovement)
- Cierres de caja parciales (CashClose)
- Eventos de pago y sesiones (PaymentEvent, Session)

Conserva:
- Usuarios y claves (User)
- Personalización/configuración del sitio (Setting)
- Categorías, productos e imágenes (Category, Product + imagePath)

Volvé a ejecutarlo con:
  ./limpiar-datos-operativos.sh --yes
MSG
  exit 0
fi

SQL=$(cat <<'SQL_EOF'
BEGIN;
TRUNCATE TABLE
  "MercadoPagoPayment",
  "SaleItem",
  "Sale",
  "ManualMovement",
  "CashClose",
  "PaymentEvent",
  "Session"
RESTART IDENTITY;
COMMIT;
SQL_EOF
)

echo "Limpiando datos operativos..."
printf '%s\n' "$SQL" | npx --yes prisma db execute --schema "$SCHEMA_PATH" --stdin

echo "✅ Limpieza completada."

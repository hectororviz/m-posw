-- Limpieza contabilidad legacy (partida doble, accounting, cash-movements).
-- La caja simple (MoneyAccount/MoneyCategory/MoneyMovement) es la única fuente.

-- DropForeignKeys de tablas que se conservan
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_journalEntryId_fkey";
ALTER TABLE "FiadoVenta" DROP CONSTRAINT IF EXISTS "FiadoVenta_journalEntryId_fkey";
ALTER TABLE "PagoAcreedor" DROP CONSTRAINT IF EXISTS "PagoAcreedor_journalEntryId_fkey";
ALTER TABLE "PagoAcreedor" DROP CONSTRAINT IF EXISTS "PagoAcreedor_treasuryAccountId_fkey";
ALTER TABLE "SocioPago" DROP CONSTRAINT IF EXISTS "SocioPago_journalEntryId_fkey";
ALTER TABLE "SocioPago" DROP CONSTRAINT IF EXISTS "SocioPago_treasuryAccountId_fkey";

-- DropColumns
ALTER TABLE "Sale" DROP COLUMN IF EXISTS "journalEntryId";
ALTER TABLE "FiadoVenta" DROP COLUMN IF EXISTS "journalEntryId";
ALTER TABLE "PagoAcreedor" DROP COLUMN IF EXISTS "journalEntryId";
ALTER TABLE "PagoAcreedor" DROP COLUMN IF EXISTS "treasuryAccountId";
ALTER TABLE "SocioPago" DROP COLUMN IF EXISTS "journalEntryId";
ALTER TABLE "SocioPago" DROP COLUMN IF EXISTS "treasuryAccountId";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableAutoJournalPos";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableAutoJournalAcreedores";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableAutoJournalSocios";

-- DropIndexes huérfanos
DROP INDEX IF EXISTS "Sale_journalEntryId_key";
DROP INDEX IF EXISTS "FiadoVenta_journalEntryId_key";
DROP INDEX IF EXISTS "PagoAcreedor_journalEntryId_key";
DROP INDEX IF EXISTS "SocioPago_journalEntryId_key";

-- DropTables legacy
DROP TABLE IF EXISTS "JournalEntryLine";
DROP TABLE IF EXISTS "JournalEntry";
DROP TABLE IF EXISTS "PaymentMethodAccount";
DROP TABLE IF EXISTS "quick_expense_buttons";
DROP TABLE IF EXISTS "LedgerAccount";
DROP TABLE IF EXISTS "AccountingMovement";
DROP TABLE IF EXISTS "ManualMovementCategory";
DROP TABLE IF EXISTS "AccountingCategory";
DROP TABLE IF EXISTS "CashMovement";

-- DropEnums legacy
DROP TYPE IF EXISTS "JournalEntryStatus";
DROP TYPE IF EXISTS "LedgerAccountType";
DROP TYPE IF EXISTS "AccountingMovementType";
DROP TYPE IF EXISTS "CashMovementType";

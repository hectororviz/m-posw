-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LedgerAccount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptsEntries" BOOLEAN NOT NULL DEFAULT true,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for LedgerAccount
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerAccount_code_key" ON "LedgerAccount"("code");
CREATE INDEX IF NOT EXISTS "LedgerAccount_type_idx" ON "LedgerAccount"("type");
CREATE INDEX IF NOT EXISTS "LedgerAccount_parentId_idx" ON "LedgerAccount"("parentId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entryNumber" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for JournalEntry
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_fiscalYear_sequenceNumber_key" ON "JournalEntry"("fiscalYear", "sequenceNumber");
CREATE INDEX IF NOT EXISTS "JournalEntry_date_idx" ON "JournalEntry"("date");
CREATE INDEX IF NOT EXISTS "JournalEntry_status_idx" ON "JournalEntry"("status");
CREATE INDEX IF NOT EXISTS "JournalEntry_fiscalYear_sequenceNumber_idx" ON "JournalEntry"("fiscalYear", "sequenceNumber");

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalEntryLine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for JournalEntryLine
CREATE INDEX IF NOT EXISTS "JournalEntryLine_entryId_idx" ON "JournalEntryLine"("entryId");
CREATE INDEX IF NOT EXISTS "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- AddForeignKey
ALTER TABLE "LedgerAccount" DROP CONSTRAINT IF EXISTS "LedgerAccount_parentId_fkey";
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_createdById_fkey";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_reversalOfId_fkey";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntryLine" DROP CONSTRAINT IF EXISTS "JournalEntryLine_entryId_fkey";
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalEntryLine" DROP CONSTRAINT IF EXISTS "JournalEntryLine_accountId_fkey";
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

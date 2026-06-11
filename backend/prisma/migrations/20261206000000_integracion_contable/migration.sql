-- CreateTable
CREATE TABLE "PaymentMethodAccount" (
    "id" SERIAL NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "ledgerAccountId" UUID NOT NULL,

    CONSTRAINT "PaymentMethodAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodAccount_paymentMethod_key" ON "PaymentMethodAccount"("paymentMethod");

-- AddForeignKey
ALTER TABLE "PaymentMethodAccount" ADD CONSTRAINT "PaymentMethodAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable - JournalEntry: sourceType + sourceId
ALTER TABLE "JournalEntry" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "sourceId" INTEGER;

-- AlterTable - Sale: journalEntryId
ALTER TABLE "Sale" ADD COLUMN "journalEntryId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_journalEntryId_key" ON "Sale"("journalEntryId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable - FiadoVenta: journalEntryId
ALTER TABLE "FiadoVenta" ADD COLUMN "journalEntryId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "FiadoVenta_journalEntryId_key" ON "FiadoVenta"("journalEntryId");

-- AddForeignKey
ALTER TABLE "FiadoVenta" ADD CONSTRAINT "FiadoVenta_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable - PagoAcreedor: journalEntryId + treasuryAccountId
ALTER TABLE "PagoAcreedor" ADD COLUMN "journalEntryId" UUID;
ALTER TABLE "PagoAcreedor" ADD COLUMN "treasuryAccountId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "PagoAcreedor_journalEntryId_key" ON "PagoAcreedor"("journalEntryId");

-- AddForeignKey
ALTER TABLE "PagoAcreedor" ADD CONSTRAINT "PagoAcreedor_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAcreedor" ADD CONSTRAINT "PagoAcreedor_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable - SocioPago: journalEntryId + treasuryAccountId
ALTER TABLE "SocioPago" ADD COLUMN "journalEntryId" UUID;
ALTER TABLE "SocioPago" ADD COLUMN "treasuryAccountId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "SocioPago_journalEntryId_key" ON "SocioPago"("journalEntryId");

-- AddForeignKey
ALTER TABLE "SocioPago" ADD CONSTRAINT "SocioPago_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioPago" ADD CONSTRAINT "SocioPago_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

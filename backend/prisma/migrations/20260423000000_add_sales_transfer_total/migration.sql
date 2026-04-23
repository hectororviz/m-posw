-- Add salesTransferTotal column to CashClose table
ALTER TABLE "CashClose" ADD COLUMN "salesTransferTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "enableAutoJournalPos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN "enableAutoJournalAcreedores" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN "enableAutoJournalSocios" BOOLEAN NOT NULL DEFAULT true;

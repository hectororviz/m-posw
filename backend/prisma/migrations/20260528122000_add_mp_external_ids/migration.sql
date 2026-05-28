-- AlterTable
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpExternalPosId" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpExternalStoreId" TEXT;

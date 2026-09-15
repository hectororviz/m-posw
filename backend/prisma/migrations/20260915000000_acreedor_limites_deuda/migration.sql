-- AlterTable: guard with IF NOT EXISTS since columns may already exist
ALTER TABLE "Acreedor" ADD COLUMN IF NOT EXISTS "limiteDeuda" DECIMAL(10,2);
ALTER TABLE "Acreedor" ADD COLUMN IF NOT EXISTS "advertenciaDeuda" DECIMAL(10,2);

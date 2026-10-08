-- Tipo de terminal en PosDevice (ENTRADAS | POS). Las terminales existentes quedan como ENTRADAS.

-- CreateEnum
CREATE TYPE "PosDeviceTipo" AS ENUM ('ENTRADAS', 'POS');

-- AlterTable
ALTER TABLE "PosDevice" ADD COLUMN "tipo" "PosDeviceTipo" NOT NULL DEFAULT 'ENTRADAS';

-- CreateIndex
CREATE INDEX "PosDevice_tipo_idx" ON "PosDevice"("tipo");

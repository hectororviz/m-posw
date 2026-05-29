-- Add FIADO to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'FIADO';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Acreedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Acreedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FiadoVenta" (
    "id" SERIAL NOT NULL,
    "ventaId" UUID NOT NULL,
    "acreedorId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiadoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FiadoVenta_ventaId_key" ON "FiadoVenta"("ventaId");
CREATE INDEX IF NOT EXISTS "FiadoVenta_acreedorId_idx" ON "FiadoVenta"("acreedorId");
CREATE INDEX IF NOT EXISTS "FiadoVenta_ventaId_idx" ON "FiadoVenta"("ventaId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "PagoAcreedor" (
    "id" SERIAL NOT NULL,
    "acreedorId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "medioPago" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagoAcreedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PagoAcreedor_acreedorId_idx" ON "PagoAcreedor"("acreedorId");

-- AddForeignKey
ALTER TABLE "FiadoVenta" DROP CONSTRAINT IF EXISTS "FiadoVenta_ventaId_fkey";
ALTER TABLE "FiadoVenta" ADD CONSTRAINT "FiadoVenta_ventaId_fkey"
  FOREIGN KEY ("ventaId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FiadoVenta" DROP CONSTRAINT IF EXISTS "FiadoVenta_acreedorId_fkey";
ALTER TABLE "FiadoVenta" ADD CONSTRAINT "FiadoVenta_acreedorId_fkey"
  FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PagoAcreedor" DROP CONSTRAINT IF EXISTS "PagoAcreedor_acreedorId_fkey";
ALTER TABLE "PagoAcreedor" ADD CONSTRAINT "PagoAcreedor_acreedorId_fkey"
  FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add enableFiadoPayment to Setting
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableFiadoPayment" BOOLEAN NOT NULL DEFAULT false;

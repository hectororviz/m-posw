-- POS de Mercado Pago propio por terminal + venta ligada a dispositivo.

-- AlterTable PosDevice: columnas MP propias (nullable; sin vincular = sin QR)
ALTER TABLE "PosDevice" ADD COLUMN "mpStoreId" TEXT,
ADD COLUMN "mpPosId" TEXT,
ADD COLUMN "mpStoreName" TEXT,
ADD COLUMN "mpPosName" TEXT,
ADD COLUMN "mpQrData" TEXT,
ADD COLUMN "mpExternalStoreId" TEXT,
ADD COLUMN "mpExternalPosId" TEXT;

-- AlterTable Sale: dispositivo de origen (null = venta web con POS principal)
ALTER TABLE "Sale" ADD COLUMN "deviceId" UUID;

-- ForeignKey + Index
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PosDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sale_deviceId_idx" ON "Sale"("deviceId");

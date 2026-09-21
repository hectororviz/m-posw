-- POS dedicado de Mercado Pago para el módulo Entradas (no toca el POS principal)

ALTER TABLE "Setting" ADD COLUMN "mpEntradasStoreId" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasPosId" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasStoreName" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasPosName" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasQrData" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasExternalStoreId" TEXT;
ALTER TABLE "Setting" ADD COLUMN "mpEntradasExternalPosId" TEXT;

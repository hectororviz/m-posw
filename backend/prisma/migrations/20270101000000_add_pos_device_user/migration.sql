-- Usuario genérico atribuible a las ventas de terminales POS (token de dispositivo).

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "posDeviceUserId" UUID;

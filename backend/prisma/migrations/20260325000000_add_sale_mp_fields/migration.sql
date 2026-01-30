-- AlterTable
ALTER TABLE "Sale"
ADD COLUMN     "mpExternalReference" TEXT,
ADD COLUMN     "mpOrderId" TEXT,
ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpQrData" TEXT,
ADD COLUMN     "mpStatus" TEXT;

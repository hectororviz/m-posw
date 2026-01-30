-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MP_QR');

-- Align SaleStatus enum values with Prisma schema
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Sale" ALTER COLUMN "status" TYPE "SaleStatus" USING (
  CASE
    WHEN "status"::text IN ('OPEN', 'PENDING_PAYMENT') THEN 'PENDING'
    WHEN "status"::text IN ('PAID') THEN 'APPROVED'
    WHEN "status"::text IN ('CANCELLED') THEN 'CANCELLED'
    WHEN "status"::text IN ('EXPIRED') THEN 'EXPIRED'
    WHEN "status"::text IN ('FAILED') THEN 'REJECTED'
    ELSE 'PENDING'
  END
)::"SaleStatus";

ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "SaleStatus_old";

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "cashReceived" DECIMAL(10, 2),
ADD COLUMN     "changeAmount" DECIMAL(10, 2);

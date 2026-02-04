-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Sale"
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "mpMerchantOrderId" TEXT,
ADD COLUMN     "mpStatusDetail" TEXT,
ADD COLUMN     "mpRaw" JSONB;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_topic_resourceId_key" ON "PaymentEvent"("provider", "topic", "resourceId");

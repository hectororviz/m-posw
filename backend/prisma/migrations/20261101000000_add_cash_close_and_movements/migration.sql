-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClose" (
    "id" UUID NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" UUID NOT NULL,
    "note" TEXT,
    "salesCashTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salesQrTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "movementsOutTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "movementsInTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "movementsNet" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netCashDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "movementsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashMovement_createdAt_idx" ON "CashMovement"("createdAt");

-- CreateIndex
CREATE INDEX "CashClose_to_idx" ON "CashClose"("to");

-- CreateIndex
CREATE INDEX "CashClose_closedAt_idx" ON "CashClose"("closedAt");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClose" ADD CONSTRAINT "CashClose_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

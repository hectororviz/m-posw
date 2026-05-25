-- CreateEnum
CREATE TYPE "AccountingMovementType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable AccountingCategory
CREATE TABLE "AccountingCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "AccountingMovementType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable AccountingMovement
CREATE TABLE "AccountingMovement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "AccountingMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "categoryId" UUID NOT NULL,
    "refMovementId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable ManualMovementCategory
CREATE TABLE "ManualMovementCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "manualMovementId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualMovementCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingMovement_date_idx" ON "AccountingMovement"("date");
CREATE INDEX "AccountingMovement_categoryId_idx" ON "AccountingMovement"("categoryId");
CREATE INDEX "AccountingMovement_type_idx" ON "AccountingMovement"("type");
CREATE UNIQUE INDEX "ManualMovementCategory_manualMovementId_key" ON "ManualMovementCategory"("manualMovementId");

-- AddForeignKey
ALTER TABLE "AccountingMovement" ADD CONSTRAINT "AccountingMovement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualMovementCategory" ADD CONSTRAINT "ManualMovementCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualMovementCategory" ADD CONSTRAINT "ManualMovementCategory_manualMovementId_fkey" FOREIGN KEY ("manualMovementId") REFERENCES "ManualMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

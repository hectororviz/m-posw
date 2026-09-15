-- CreateEnum
CREATE TYPE "MoneyAccountKind" AS ENUM ('EFECTIVO', 'MERCADOPAGO', 'BANCO', 'OTRO');

-- CreateEnum
CREATE TYPE "MoneyCategoryKind" AS ENUM ('INGRESO', 'EGRESO', 'AMBOS');

-- CreateEnum
CREATE TYPE "MoneyMovementKind" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "MoneyMovementSource" AS ENUM ('MANUAL', 'COBRO_FIADO', 'CUOTA_SOCIO', 'AJUSTE');

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MoneyAccountKind" NOT NULL DEFAULT 'OTRO',
    "initialBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MoneyCategoryKind" NOT NULL DEFAULT 'AMBOS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyMovement" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "MoneyMovementKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "accountId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "source" "MoneyMovementSource" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "userId" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_name_key" ON "MoneyAccount"("name");

-- CreateIndex
CREATE INDEX "MoneyAccount_active_idx" ON "MoneyAccount"("active");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCategory_name_key" ON "MoneyCategory"("name");

-- CreateIndex
CREATE INDEX "MoneyCategory_active_idx" ON "MoneyCategory"("active");

-- CreateIndex
CREATE INDEX "MoneyMovement_date_idx" ON "MoneyMovement"("date");

-- CreateIndex
CREATE INDEX "MoneyMovement_accountId_idx" ON "MoneyMovement"("accountId");

-- CreateIndex
CREATE INDEX "MoneyMovement_categoryId_idx" ON "MoneyMovement"("categoryId");

-- CreateIndex
CREATE INDEX "MoneyMovement_source_sourceId_idx" ON "MoneyMovement"("source", "sourceId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MoneyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

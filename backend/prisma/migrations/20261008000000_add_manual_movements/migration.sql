-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateTable
CREATE TABLE "ManualMovement" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "ManualMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualMovement_createdAt_idx" ON "ManualMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "ManualMovement" ADD CONSTRAINT "ManualMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "homeSmartphoneModule" TEXT;

-- CreateTable
CREATE TABLE "quick_expense_buttons" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "assetAccountId" UUID NOT NULL,
    "expenseAccountId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_expense_buttons_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quick_expense_buttons" ADD CONSTRAINT "quick_expense_buttons_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_expense_buttons" ADD CONSTRAINT "quick_expense_buttons_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

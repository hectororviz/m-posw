-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "enableInternetModule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InternetPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "idleTimeout" INTEGER NOT NULL DEFAULT 1800,
    "downloadBandwidth" TEXT NOT NULL DEFAULT '10M',
    "uploadBandwidth" TEXT NOT NULL DEFAULT '2M',
    "price" DECIMAL(10, 2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "productId" UUID,
    "categoryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleVoucher" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "pin" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternetPlan_productId_key" ON "InternetPlan"("productId");

-- AddForeignKey
ALTER TABLE "InternetPlan" ADD CONSTRAINT "InternetPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVoucher" ADD CONSTRAINT "SaleVoucher_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InternetPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

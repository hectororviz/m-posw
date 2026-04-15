-- Create ProductOrderCounter table
CREATE TABLE "ProductOrderCounter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "lastOrderNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrderCounter_pkey" PRIMARY KEY ("id")
);

-- Create unique index on productId
CREATE UNIQUE INDEX "ProductOrderCounter_productId_key" ON "ProductOrderCounter"("productId");

-- Add foreign key constraint
ALTER TABLE "ProductOrderCounter" ADD CONSTRAINT "ProductOrderCounter_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add ticket column to Category
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "ticket" BOOLEAN NOT NULL DEFAULT true;

-- Create ProductType enum if not exists
DO $$ BEGIN
  CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'RAW_MATERIAL', 'COMPOSITE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add type column to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "type" "ProductType" NOT NULL DEFAULT 'SIMPLE';

-- Create RecipeIngredient table
CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "compositeId" UUID NOT NULL,
    "rawMaterialId" UUID NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecipeIngredient_compositeId_idx" ON "RecipeIngredient"("compositeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecipeIngredient_rawMaterialId_idx" ON "RecipeIngredient"("rawMaterialId");

-- AddForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT IF EXISTS "RecipeIngredient_compositeId_fkey";
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_compositeId_fkey"
  FOREIGN KEY ("compositeId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipeIngredient" DROP CONSTRAINT IF EXISTS "RecipeIngredient_rawMaterialId_fkey";
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_rawMaterialId_fkey"
  FOREIGN KEY ("rawMaterialId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add payment method toggles and movement reasons to Setting
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableCashPayment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableQrPayment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableTransferPayment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "movementInReasons" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "movementOutReasons" TEXT[] NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "Category" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "iconName" TEXT NOT NULL DEFAULT 'category',
ADD COLUMN     "colorHex" TEXT NOT NULL DEFAULT '#0EA5E9';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "iconName" TEXT,
ADD COLUMN     "colorHex" TEXT;

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "logoUrl" DROP NOT NULL,
ALTER COLUMN "faviconUrl" DROP NOT NULL;

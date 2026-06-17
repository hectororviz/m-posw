-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'VENTAS';
ALTER TYPE "ModuleKey" ADD VALUE 'PRODUCTOS';

-- Migrate existing STOCK permissions to PRODUCTOS
UPDATE "UserModulePermission" SET module = 'PRODUCTOS' WHERE module = 'STOCK';

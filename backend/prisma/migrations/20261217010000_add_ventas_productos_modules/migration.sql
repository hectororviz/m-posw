-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'VENTAS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'PRODUCTOS';

-- Migrate existing STOCK permissions to PRODUCTOS
UPDATE "UserModulePermission" SET module = 'PRODUCTOS' WHERE module = 'STOCK';

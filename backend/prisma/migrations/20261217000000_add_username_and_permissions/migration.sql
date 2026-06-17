-- DropIndex
DROP INDEX IF EXISTS "User_name_key";

-- RenameColumn
ALTER TABLE "User" RENAME COLUMN "name" TO "username";

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "homeModule" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModuleKey" AS ENUM ('POS', 'SOCIOS', 'TESORERIA', 'ACREEDORES', 'INTERNET', 'STOCK', 'REPORTES', 'CONFIGURACION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModuleAccess" AS ENUM ('HIDDEN', 'READ', 'FULL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserModulePermission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "access" "ModuleAccess" NOT NULL,
    CONSTRAINT "UserModulePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserModulePermission_userId_module_key" ON "UserModulePermission"("userId", "module");

-- AddForeignKey
ALTER TABLE "UserModulePermission" DROP CONSTRAINT IF EXISTS "UserModulePermission_userId_fkey";
ALTER TABLE "UserModulePermission" ADD CONSTRAINT "UserModulePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

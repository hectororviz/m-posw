-- Add module enable/disable toggles to Setting
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableSociosModule" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableTreasuryModule" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableAcreedoresModule" BOOLEAN NOT NULL DEFAULT true;

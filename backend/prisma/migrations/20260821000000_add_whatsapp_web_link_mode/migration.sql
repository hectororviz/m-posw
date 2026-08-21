-- Add WhatsApp Web link mode settings
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappUseApi" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappWebMessage" TEXT;

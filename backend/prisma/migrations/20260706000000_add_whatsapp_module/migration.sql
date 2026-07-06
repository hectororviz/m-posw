-- Add WHATSAPP to ModuleKey enum
DO $$ BEGIN
  ALTER TYPE "ModuleKey" ADD VALUE 'WHATSAPP';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add WhatsApp settings columns to Setting table
ALTER TABLE "Setting"
  ADD COLUMN IF NOT EXISTS "enableWhatsappModule" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "openwaApiUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "openwaApiKey" TEXT,
  ADD COLUMN IF NOT EXISTS "openwaSessionName" TEXT DEFAULT 'mposw',
  ADD COLUMN IF NOT EXISTS "openwaMessageTemplate" TEXT;

-- Create NotificationLog table
CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" SERIAL NOT NULL,
    "recipient" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acreedorId" INTEGER,
    "sourceModule" TEXT DEFAULT 'ACREEDORES',

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- Add FK to Acreedor
DO $$ BEGIN
  ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_acreedorId_fkey"
    FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "NotificationLog_acreedorId_idx" ON "NotificationLog"("acreedorId");
CREATE INDEX IF NOT EXISTS "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX IF NOT EXISTS "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

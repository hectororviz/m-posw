-- Drop old tables if they exist
DROP TABLE IF EXISTS "ConversationMessage" CASCADE;
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "NotificationJob" CASCADE;
DROP TABLE IF EXISTS "NotificationLog" CASCADE;

-- Remove old settings columns
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableWhatsappModule";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaApiUrl";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaApiKey";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaSessionName";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaMessageTemplate";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaMinDelay";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "openwaMaxDelay";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "httpsmsApiKey";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "httpsmsBaseUrl";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "httpsmsFromNumber";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "httpsmsSigningKey";
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "debtReminderTemplate";

-- Remove old enableNotificationsModule (will be re-added with new name)
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableNotificationsModule";

-- Add new WhatsApp Cloud API settings
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableNotificationsModule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappAccessToken" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappBusinessAccountId" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappWebhookVerifyToken" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappMessageTemplate" TEXT;

-- Create new NotificationLog table
CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "recipient" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "messageText" TEXT NOT NULL,
    "templateUsed" TEXT,
    "errorMessage" TEXT,
    "externalMessageId" TEXT,
    "acreedorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- Create new NotificationJob table
CREATE TABLE "NotificationJob" (
    "id" SERIAL NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "templateName" TEXT,
    "templateParams" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "externalMessageId" TEXT,
    "acreedorId" INTEGER,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "NotificationLog_acreedorId_idx" ON "NotificationLog"("acreedorId");
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");
CREATE INDEX "NotificationJob_acreedorId_idx" ON "NotificationJob"("acreedorId");
CREATE INDEX "NotificationJob_status_idx" ON "NotificationJob"("status");
CREATE INDEX "NotificationJob_batchId_idx" ON "NotificationJob"("batchId");
CREATE INDEX "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");

-- Add foreign keys
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

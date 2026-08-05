-- Add template name and app secret fields
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappTemplateName" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappAppSecret" TEXT;

-- Create WhatsAppConversation table
CREATE TABLE "WhatsAppConversation" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "acreedorId" INTEGER,
    "lastMessageAt" TIMESTAMP(3),
    "lastIncomingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- Create WhatsAppMessage table
CREATE TABLE "WhatsAppMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "WhatsAppConversation_phoneNumber_key" ON "WhatsAppConversation"("phoneNumber");
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");
CREATE INDEX "WhatsAppMessage_conversationId_idx" ON "WhatsAppMessage"("conversationId");
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
CREATE INDEX "WhatsAppMessage_externalMessageId_idx" ON "WhatsAppMessage"("externalMessageId");

-- Add foreign keys
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

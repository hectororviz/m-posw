-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'NOTIFICACIONES';

-- AlterTable: Setting new fields
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableNotificationsModule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "httpsmsApiKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "httpsmsBaseUrl" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "httpsmsFromNumber" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "httpsmsSigningKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "debtReminderTemplate" TEXT;

-- AlterTable: NotificationJob new fields (guard: table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'NotificationJob') THEN
    ALTER TABLE "NotificationJob" ADD COLUMN IF NOT EXISTS "provider" TEXT;
    ALTER TABLE "NotificationJob" ADD COLUMN IF NOT EXISTS "externalMessageId" TEXT;
    CREATE INDEX IF NOT EXISTS "NotificationJob_externalMessageId_idx" ON "NotificationJob"("externalMessageId");
  END IF;
END $$;

-- CreateTable: Conversation
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for Conversation
CREATE INDEX IF NOT EXISTS "Conversation_memberId_idx" ON "Conversation"("memberId");
CREATE INDEX IF NOT EXISTS "Conversation_phoneNumber_idx" ON "Conversation"("phoneNumber");
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateTable: ConversationMessage
CREATE TABLE IF NOT EXISTS "ConversationMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for ConversationMessage
CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_idx" ON "ConversationMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ConversationMessage_externalMessageId_idx" ON "ConversationMessage"("externalMessageId");

-- AddForeignKey for ConversationMessage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ConversationMessage')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ConversationMessage_conversationId_fkey' AND table_name = 'ConversationMessage') THEN
    ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

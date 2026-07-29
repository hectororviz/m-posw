-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'NOTIFICACIONES';

-- AlterTable: Setting new fields
ALTER TABLE "Setting" ADD COLUMN "enableNotificationsModule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Setting" ADD COLUMN "httpsmsApiKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN "httpsmsBaseUrl" TEXT;
ALTER TABLE "Setting" ADD COLUMN "httpsmsFromNumber" TEXT;
ALTER TABLE "Setting" ADD COLUMN "httpsmsSigningKey" TEXT;
ALTER TABLE "Setting" ADD COLUMN "debtReminderTemplate" TEXT;

-- AlterTable: NotificationJob new fields
ALTER TABLE "NotificationJob" ADD COLUMN "provider" TEXT;
ALTER TABLE "NotificationJob" ADD COLUMN "externalMessageId" TEXT;

-- CreateIndex on NotificationJob.externalMessageId
CREATE INDEX "NotificationJob_externalMessageId_idx" ON "NotificationJob"("externalMessageId");

-- CreateTable: Conversation
CREATE TABLE "Conversation" (
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
CREATE INDEX "Conversation_memberId_idx" ON "Conversation"("memberId");
CREATE INDEX "Conversation_phoneNumber_idx" ON "Conversation"("phoneNumber");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateTable: ConversationMessage
CREATE TABLE "ConversationMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for ConversationMessage
CREATE INDEX "ConversationMessage_conversationId_idx" ON "ConversationMessage"("conversationId");
CREATE INDEX "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");
CREATE INDEX "ConversationMessage_externalMessageId_idx" ON "ConversationMessage"("externalMessageId");

-- AddForeignKey for ConversationMessage
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

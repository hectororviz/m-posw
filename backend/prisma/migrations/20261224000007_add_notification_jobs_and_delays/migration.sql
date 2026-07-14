-- AlterTable
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "openwaMinDelay" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "openwaMaxDelay" INTEGER NOT NULL DEFAULT 120;

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" SERIAL NOT NULL,
    "creditorId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'DEBT_REMINDER',
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "payload" JSONB,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationJob_creditorId_idx" ON "NotificationJob"("creditorId");
CREATE INDEX "NotificationJob_status_idx" ON "NotificationJob"("status");
CREATE INDEX "NotificationJob_type_idx" ON "NotificationJob"("type");
CREATE INDEX "NotificationJob_batchId_idx" ON "NotificationJob"("batchId");
CREATE INDEX "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

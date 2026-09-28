-- CreateTable: cola persistente de webhooks MP con backoff (Fase 5 M1, sin Redis)
CREATE TABLE IF NOT EXISTS "WebhookRetry" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'MP',
  "topic" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "requestId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3) NOT NULL,
  "lastError" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookRetry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookRetry_provider_topic_resourceId_key') THEN
    ALTER TABLE "WebhookRetry" ADD CONSTRAINT "WebhookRetry_provider_topic_resourceId_key" UNIQUE ("provider", "topic", "resourceId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WebhookRetry_status_nextRetryAt_idx" ON "WebhookRetry"("status", "nextRetryAt");

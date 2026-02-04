-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opening_float" DECIMAL(10,2) NOT NULL,
    "opening_note" TEXT,
    "closing_note" TEXT,
    "opened_by_user_id" UUID NOT NULL,
    "closed_by_user_id" UUID,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_sessions_opened_by_user_id_idx" ON "cash_sessions"("opened_by_user_id");

-- CreateIndex
CREATE INDEX "cash_sessions_closed_by_user_id_idx" ON "cash_sessions"("closed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_open_unique" ON "cash_sessions" ((1)) WHERE "closed_at" IS NULL;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

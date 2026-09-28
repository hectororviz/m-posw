-- AlterTable: agrega cursor persistido del polling de transferencias MP (Fase 3 H3)
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "lastMpPollAt" TIMESTAMP(3);

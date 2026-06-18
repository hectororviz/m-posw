-- AlterTable
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "enableLigasModule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LigasConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigasConfig_pkey" PRIMARY KEY ("id")
);

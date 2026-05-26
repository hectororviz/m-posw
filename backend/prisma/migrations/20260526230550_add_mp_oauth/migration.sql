-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "mpAccessToken" TEXT,
ADD COLUMN     "mpLinked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mpRefreshToken" TEXT,
ADD COLUMN     "mpTokenExpiresAt" TIMESTAMP(3);

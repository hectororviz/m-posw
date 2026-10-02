-- AlterTable
ALTER TABLE "Setting" ADD COLUMN "releaseReportEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastOutflowSyncAt" TIMESTAMP(3);

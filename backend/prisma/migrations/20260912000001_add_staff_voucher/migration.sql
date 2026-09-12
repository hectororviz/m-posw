-- CreateTable: guard with IF NOT EXISTS since table may already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StaffVoucher') THEN
    CREATE TABLE "StaffVoucher" (
        "id" UUID NOT NULL,
        "pin" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "notes" TEXT,
        "duration" INTEGER NOT NULL,
        "downloadBandwidth" TEXT NOT NULL DEFAULT '10M',
        "uploadBandwidth" TEXT NOT NULL DEFAULT '2M',
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdById" UUID NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deactivatedAt" TIMESTAMP(3),
        "deactivatedById" UUID,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "StaffVoucher_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "StaffVoucher_pin_key" ON "StaffVoucher"("pin");
  END IF;
END $$;

-- CreateFKs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffVoucher_createdById_fkey') THEN
    ALTER TABLE "StaffVoucher" ADD CONSTRAINT "StaffVoucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffVoucher_deactivatedById_fkey') THEN
    ALTER TABLE "StaffVoucher" ADD CONSTRAINT "StaffVoucher_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

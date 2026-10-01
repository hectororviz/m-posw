-- Auditoría MP + reorden Tesorería (corte 01/09/26)
-- MoneyCategory.grupo
ALTER TABLE "MoneyCategory" ADD COLUMN IF NOT EXISTS "grupo" TEXT NOT NULL DEFAULT 'OPERATIVO';

-- Responsable ABM
CREATE TABLE IF NOT EXISTS "Responsable" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Responsable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Responsable_nombre_key" ON "Responsable"("nombre");
CREATE INDEX IF NOT EXISTS "Responsable_active_idx" ON "Responsable"("active");

-- MoneyMovementSource: VENTA, TRASPASO, MP_SYNC
ALTER TYPE "MoneyMovementSource" ADD VALUE IF NOT EXISTS 'VENTA';
ALTER TYPE "MoneyMovementSource" ADD VALUE IF NOT EXISTS 'TRASPASO';
ALTER TYPE "MoneyMovementSource" ADD VALUE IF NOT EXISTS 'MP_SYNC';

-- MoneyMovement extensions
ALTER TABLE "MoneyMovement" ADD COLUMN IF NOT EXISTS "concepto" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MoneyMovement" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;
ALTER TABLE "MoneyMovement" ADD COLUMN IF NOT EXISTS "responsableId" TEXT;
ALTER TABLE "MoneyMovement" ADD COLUMN IF NOT EXISTS "transferGroupId" TEXT;
DO $$ BEGIN
  ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Responsable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "MoneyMovement_transferGroupId_idx" ON "MoneyMovement"("transferGroupId");
CREATE INDEX IF NOT EXISTS "MoneyMovement_responsableId_idx" ON "MoneyMovement"("responsableId");

-- Setting: auditoría MP
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpAuditEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpAuditSince" TIMESTAMP(3);
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpAuditCursor" TIMESTAMP(3);
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpBalanceCached" DECIMAL(12,2);
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "mpBalanceAt" TIMESTAMP(3);

-- Enums auditoría
DO $$ BEGIN CREATE TYPE "MpMovementType" AS ENUM ('COBRO_QR', 'TRANSFERENCIA', 'RETIRO', 'GASTO', 'FEE', 'REFUND', 'CHARGEBACK', 'OTRO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MpAuditStatus" AS ENUM ('PENDIENTE', 'SUGERIDO', 'CONCILIADO', 'IGNORADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MpAccountMovement
CREATE TABLE IF NOT EXISTS "MpAccountMovement" (
  "id" UUID NOT NULL,
  "mpPaymentId" TEXT NOT NULL,
  "tipo" "MpMovementType" NOT NULL DEFAULT 'OTRO',
  "estado" "MpAuditStatus" NOT NULL DEFAULT 'PENDIENTE',
  "montoBruto" DECIMAL(12,2) NOT NULL,
  "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "montoNeto" DECIMAL(12,2) NOT NULL,
  "pagador" TEXT,
  "email" TEXT,
  "externalRef" TEXT,
  "merchantOrderId" TEXT,
  "fechaMp" TIMESTAMP(3) NOT NULL,
  "raw" JSONB,
  "conciliadoPorId" TEXT,
  "conciliadoAt" TIMESTAMP(3),
  "nota" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MpAccountMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MpAccountMovement_mpPaymentId_key" ON "MpAccountMovement"("mpPaymentId");
CREATE INDEX IF NOT EXISTS "MpAccountMovement_estado_idx" ON "MpAccountMovement"("estado");
CREATE INDEX IF NOT EXISTS "MpAccountMovement_tipo_idx" ON "MpAccountMovement"("tipo");
CREATE INDEX IF NOT EXISTS "MpAccountMovement_fechaMp_idx" ON "MpAccountMovement"("fechaMp");
CREATE INDEX IF NOT EXISTS "MpAccountMovement_montoNeto_idx" ON "MpAccountMovement"("montoNeto");

-- MpConciliacion (puente 1:N)
CREATE TABLE IF NOT EXISTS "MpConciliacion" (
  "id" UUID NOT NULL,
  "mpMovementId" UUID NOT NULL,
  "saleId" UUID,
  "moneyMovementId" UUID,
  "montoAsignado" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MpConciliacion_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "MpConciliacion" ADD CONSTRAINT "MpConciliacion_mpMovementId_fkey" FOREIGN KEY ("mpMovementId") REFERENCES "MpAccountMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MpConciliacion" ADD CONSTRAINT "MpConciliacion_moneyMovementId_fkey" FOREIGN KEY ("moneyMovementId") REFERENCES "MoneyMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "MpConciliacion_mpMovementId_idx" ON "MpConciliacion"("mpMovementId");
CREATE INDEX IF NOT EXISTS "MpConciliacion_saleId_idx" ON "MpConciliacion"("saleId");
CREATE INDEX IF NOT EXISTS "MpConciliacion_moneyMovementId_idx" ON "MpConciliacion"("moneyMovementId");

-- MpSyncJob
CREATE TABLE IF NOT EXISTS "MpSyncJob" (
  "id" UUID NOT NULL,
  "since" TIMESTAMP(3) NOT NULL,
  "until" TIMESTAMP(3) NOT NULL,
  "offset" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MpSyncJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MpSyncJob_status_idx" ON "MpSyncJob"("status");

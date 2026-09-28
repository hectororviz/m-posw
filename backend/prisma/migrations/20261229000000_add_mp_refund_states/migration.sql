-- AlterEnum: nuevos estados de homologación MP (Fase 4 H1)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CHARGEBACK';

-- AlterTable: idempotencia persistida (diferida de Fase 2) + marca de reembolso
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "mpIdempotencyKey" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- Add TRANSFER to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- Create MovimientoMP table
CREATE TABLE IF NOT EXISTS "MovimientoMP" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "saleId" UUID REFERENCES "Sale"(id) ON DELETE SET NULL,
    "paymentId" TEXT UNIQUE NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    "montoEsperado" DECIMAL(10, 2) NOT NULL,
    pagador TEXT,
    tipo TEXT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    notificado BOOLEAN DEFAULT false,
    procesado BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for MovimientoMP
CREATE INDEX IF NOT EXISTS "MovimientoMP_saleId_idx" ON "MovimientoMP"("saleId");
CREATE INDEX IF NOT EXISTS "MovimientoMP_paymentId_idx" ON "MovimientoMP"("paymentId");
CREATE INDEX IF NOT EXISTS "MovimientoMP_notificado_idx" ON "MovimientoMP"(notificado);
CREATE INDEX IF NOT EXISTS "MovimientoMP_createdAt_idx" ON "MovimientoMP"("createdAt");

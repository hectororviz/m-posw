-- Beneficios de entradas para bufet (QR corto por TicketUnit)
CREATE TYPE "EntradaBeneficioSector" AS ENUM ('LOCAL', 'VISITANTE', 'AMBAS');

CREATE TABLE "EntradaBeneficio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "sector" "EntradaBeneficioSector" NOT NULL DEFAULT 'AMBAS',
    "categoriaProdId" UUID,
    "productoId" UUID,
    "internetPlanId" UUID,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descuentoMaximo" DECIMAL(10,2),
    "usoUnico" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaBeneficio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntradaBeneficioConsumo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beneficioId" UUID NOT NULL,
    "ticketUnitId" UUID NOT NULL,
    "consumidoPorDeviceId" UUID,
    "consumidoPorUsuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntradaBeneficioConsumo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntradaBeneficioValidacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beneficioId" UUID NOT NULL,
    "ticketUnitId" UUID NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntradaBeneficioValidacion_pkey" PRIMARY KEY ("id")
);

-- TicketUnit: beneficio + QR corto (null = sin beneficio)
ALTER TABLE "TicketUnit" ADD COLUMN "beneficioId" UUID;
ALTER TABLE "TicketUnit" ADD COLUMN "benefitCode" TEXT;
ALTER TABLE "TicketUnit" ADD COLUMN "beneficioPorcentaje" DECIMAL(5,2);

CREATE UNIQUE INDEX "TicketUnit_benefitCode_key" ON "TicketUnit"("benefitCode");
CREATE INDEX "TicketUnit_beneficioId_idx" ON "TicketUnit"("beneficioId");
CREATE INDEX "TicketUnit_benefitCode_idx" ON "TicketUnit"("benefitCode");
CREATE UNIQUE INDEX "EntradaBeneficioConsumo_ticketUnitId_key" ON "EntradaBeneficioConsumo"("ticketUnitId");
CREATE INDEX "EntradaBeneficioConsumo_beneficioId_idx" ON "EntradaBeneficioConsumo"("beneficioId");
CREATE INDEX "EntradaBeneficioValidacion_ticketUnitId_idx" ON "EntradaBeneficioValidacion"("ticketUnitId");
CREATE INDEX "EntradaBeneficioValidacion_beneficioId_idx" ON "EntradaBeneficioValidacion"("beneficioId");
CREATE INDEX "EntradaBeneficio_activo_idx" ON "EntradaBeneficio"("activo");
CREATE INDEX "EntradaBeneficio_sector_idx" ON "EntradaBeneficio"("sector");

ALTER TABLE "EntradaBeneficio" ADD CONSTRAINT "EntradaBeneficio_categoriaProdId_fkey" FOREIGN KEY ("categoriaProdId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficio" ADD CONSTRAINT "EntradaBeneficio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficio" ADD CONSTRAINT "EntradaBeneficio_internetPlanId_fkey" FOREIGN KEY ("internetPlanId") REFERENCES "InternetPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketUnit" ADD CONSTRAINT "TicketUnit_beneficioId_fkey" FOREIGN KEY ("beneficioId") REFERENCES "EntradaBeneficio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficioConsumo" ADD CONSTRAINT "EntradaBeneficioConsumo_beneficioId_fkey" FOREIGN KEY ("beneficioId") REFERENCES "EntradaBeneficio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficioConsumo" ADD CONSTRAINT "EntradaBeneficioConsumo_ticketUnitId_fkey" FOREIGN KEY ("ticketUnitId") REFERENCES "TicketUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficioValidacion" ADD CONSTRAINT "EntradaBeneficioValidacion_beneficioId_fkey" FOREIGN KEY ("beneficioId") REFERENCES "EntradaBeneficio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntradaBeneficioValidacion" ADD CONSTRAINT "EntradaBeneficioValidacion_ticketUnitId_fkey" FOREIGN KEY ("ticketUnitId") REFERENCES "TicketUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

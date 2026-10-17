-- Eventos especiales de entradas: tabla propia sin torneo ni rival.
-- Las ventas/unidades de eventos usan eventoId + sector NULL (la app muestra "General").

-- CreateTable
CREATE TABLE "EntradaEvento" (
  "id" UUID NOT NULL,
  "titulo" VARCHAR(32) NOT NULL,
  "fecha" DATE NOT NULL,
  "ventanaDesde" TIMESTAMP(3) NOT NULL,
  "ventanaHasta" TIMESTAMP(3) NOT NULL,
  "precio" DECIMAL(10, 2) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntradaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaEventoContador" (
  "eventoId" UUID NOT NULL,
  "ultimoNro" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntradaEventoContador_pkey" PRIMARY KEY ("eventoId")
);

-- CreateIndex
CREATE INDEX "EntradaEvento_activo_idx" ON "EntradaEvento"("activo");

-- CreateIndex
CREATE INDEX "EntradaEvento_ventanaDesde_ventanaHasta_idx" ON "EntradaEvento"("ventanaDesde", "ventanaHasta");

-- AlterTable (ventas y unidades: fixture opcional + evento opcional)
ALTER TABLE "TicketSale" ALTER COLUMN "fixtureId" DROP NOT NULL;
ALTER TABLE "TicketSale" ALTER COLUMN "sector" DROP NOT NULL;
ALTER TABLE "TicketSale" ADD COLUMN "eventoId" UUID;

ALTER TABLE "TicketUnit" ALTER COLUMN "fixtureId" DROP NOT NULL;
ALTER TABLE "TicketUnit" ALTER COLUMN "sector" DROP NOT NULL;
ALTER TABLE "TicketUnit" ADD COLUMN "eventoId" UUID;

-- AddForeignKey
ALTER TABLE "TicketSale" ADD CONSTRAINT "TicketSale_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EntradaEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketUnit" ADD CONSTRAINT "TicketUnit_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EntradaEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaEventoContador" ADD CONSTRAINT "EntradaEventoContador_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EntradaEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TicketSale_eventoId_idx" ON "TicketSale"("eventoId");

-- CreateIndex
CREATE INDEX "TicketUnit_eventoId_idx" ON "TicketUnit"("eventoId");

-- Unicidad por evento (los NULL no colisionan en Postgres: solo una rama aplica por fila)
CREATE UNIQUE INDEX "TicketUnit_eventoId_sector_nro_key" ON "TicketUnit"("eventoId", "sector", "nro");
CREATE UNIQUE INDEX "TicketUnit_eventoId_codigo_key" ON "TicketUnit"("eventoId", "codigo");

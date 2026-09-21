-- Módulo Entradas (POS externo + térmica): torneos, rivales, calendario con ventana, devices, ventas L/V, template ticket

-- CreateEnum
CREATE TYPE "EntradaSector" AS ENUM ('LOCAL', 'VISITANTE');

-- CreateEnum
CREATE TYPE "EntradaPayMethod" AS ENUM ('CASH', 'MP_QR');

-- CreateEnum
CREATE TYPE "EntradaSaleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- AlterTable Setting
ALTER TABLE "Setting" ADD COLUMN "enableEntradasModule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable EntradaTorneo
CREATE TABLE "EntradaTorneo" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10, 2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaTorneo_pkey" PRIMARY KEY ("id")
);

-- CreateTable EntradaRival
CREATE TABLE "EntradaRival" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaRival_pkey" PRIMARY KEY ("id")
);

-- CreateTable EntradaFixture
CREATE TABLE "EntradaFixture" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "torneoId" UUID NOT NULL,
    "rivalId" UUID NOT NULL,
    "ventanaDesde" TIMESTAMP(3) NOT NULL,
    "ventanaHasta" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable PosDevice
CREATE TABLE "PosDevice" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketSale
CREATE TABLE "TicketSale" (
    "id" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "sector" "EntradaSector" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnit" DECIMAL(10, 2) NOT NULL,
    "descuento" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10, 2) NOT NULL,
    "paymentMethod" "EntradaPayMethod" NOT NULL,
    "status" "EntradaSaleStatus" NOT NULL DEFAULT 'PENDING',
    "mpExternalReference" TEXT,
    "mpOrderId" TEXT,
    "deviceId" UUID NOT NULL,
    "socioId" INTEGER,
    "beneficioId" UUID,
    "requestId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable TicketUnit
CREATE TABLE "TicketUnit" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "sector" "EntradaSector" NOT NULL,
    "nro" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable EntradaContador
CREATE TABLE "EntradaContador" (
    "fixtureId" UUID NOT NULL,
    "sector" "EntradaSector" NOT NULL,
    "ultimoNro" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaContador_pkey" PRIMARY KEY ("fixtureId", "sector")
);

-- CreateTable EntradaTicketTemplate
CREATE TABLE "EntradaTicketTemplate" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "widthCols" INTEGER NOT NULL DEFAULT 32,
    "layout" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaTicketTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable EntradaTicketAsset
CREATE TABLE "EntradaTicketAsset" (
    "id" TEXT NOT NULL DEFAULT 'escudo',
    "version" INTEGER NOT NULL DEFAULT 1,
    "pngBase64" TEXT,
    "widthPx" INTEGER NOT NULL DEFAULT 256,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntradaTicketAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable SocioBeneficio (beneficios aplicables a torneos de entradas, null = todos)
ALTER TABLE "SocioBeneficio" ADD COLUMN "entradaTorneoId" UUID;

-- AlterTable SocioCanje (canjes desde POS sin usuario humano: usuarioId nullable, posId = deviceId)
ALTER TABLE "SocioCanje" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EntradaTorneo_nombre_key" ON "EntradaTorneo"("nombre");
CREATE INDEX "EntradaTorneo_activo_idx" ON "EntradaTorneo"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaRival_nombre_key" ON "EntradaRival"("nombre");
CREATE INDEX "EntradaRival_activo_idx" ON "EntradaRival"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaFixture_fecha_torneoId_rivalId_key" ON "EntradaFixture"("fecha", "torneoId", "rivalId");
CREATE INDEX "EntradaFixture_torneoId_idx" ON "EntradaFixture"("torneoId");
CREATE INDEX "EntradaFixture_rivalId_idx" ON "EntradaFixture"("rivalId");
CREATE INDEX "EntradaFixture_activo_idx" ON "EntradaFixture"("activo");
CREATE INDEX "EntradaFixture_ventanaDesde_ventanaHasta_idx" ON "EntradaFixture"("ventanaDesde", "ventanaHasta");

-- CreateIndex
CREATE UNIQUE INDEX "PosDevice_tokenHash_key" ON "PosDevice"("tokenHash");
CREATE INDEX "PosDevice_activo_idx" ON "PosDevice"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSale_mpExternalReference_key" ON "TicketSale"("mpExternalReference");
CREATE UNIQUE INDEX "TicketSale_requestId_key" ON "TicketSale"("requestId");
CREATE INDEX "TicketSale_fixtureId_idx" ON "TicketSale"("fixtureId");
CREATE INDEX "TicketSale_deviceId_idx" ON "TicketSale"("deviceId");
CREATE INDEX "TicketSale_status_idx" ON "TicketSale"("status");
CREATE INDEX "TicketSale_createdAt_idx" ON "TicketSale"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketUnit_fixtureId_sector_nro_key" ON "TicketUnit"("fixtureId", "sector", "nro");
CREATE UNIQUE INDEX "TicketUnit_fixtureId_codigo_key" ON "TicketUnit"("fixtureId", "codigo");
CREATE INDEX "TicketUnit_saleId_idx" ON "TicketUnit"("saleId");
CREATE INDEX "TicketUnit_fixtureId_idx" ON "TicketUnit"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "SocioBeneficio_socioTipoId_entradaTorneoId_key" ON "SocioBeneficio"("socioTipoId", "entradaTorneoId");
CREATE INDEX "SocioBeneficio_entradaTorneoId_idx" ON "SocioBeneficio"("entradaTorneoId");

-- AddForeignKey
ALTER TABLE "EntradaFixture" ADD CONSTRAINT "EntradaFixture_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "EntradaTorneo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaFixture" ADD CONSTRAINT "EntradaFixture_rivalId_fkey" FOREIGN KEY ("rivalId") REFERENCES "EntradaRival"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSale" ADD CONSTRAINT "TicketSale_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "EntradaFixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSale" ADD CONSTRAINT "TicketSale_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PosDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketUnit" ADD CONSTRAINT "TicketUnit_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "TicketSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketUnit" ADD CONSTRAINT "TicketUnit_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "EntradaFixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaContador" ADD CONSTRAINT "EntradaContador_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "EntradaFixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioBeneficio" ADD CONSTRAINT "SocioBeneficio_entradaTorneoId_fkey" FOREIGN KEY ("entradaTorneoId") REFERENCES "EntradaTorneo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

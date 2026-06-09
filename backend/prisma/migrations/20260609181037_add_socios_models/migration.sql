-- CreateEnum
CREATE TYPE "SocioEstado" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "SocioCuotaEstado" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO');

-- CreateTable
CREATE TABLE "SocioTipo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoMensual" DECIMAL(10,2) NOT NULL,
    "comentario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocioTipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocioTipoHistorial" (
    "id" SERIAL NOT NULL,
    "socioTipoId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocioTipoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Socio" (
    "id" SERIAL NOT NULL,
    "nroSocio" INTEGER NOT NULL,
    "dni" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "telefono" TEXT,
    "direccion" TEXT,
    "socioTipoId" INTEGER NOT NULL,
    "fechaAlta" TIMESTAMP(3) NOT NULL,
    "estado" "SocioEstado" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocioCuota" (
    "id" SERIAL NOT NULL,
    "socioId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoOriginal" DECIMAL(10,2) NOT NULL,
    "montoPagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" "SocioCuotaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocioCuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocioPago" (
    "id" SERIAL NOT NULL,
    "socioCuotaId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocioPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocioTipo_nombre_key" ON "SocioTipo"("nombre");

-- CreateIndex
CREATE INDEX "SocioTipoHistorial_socioTipoId_idx" ON "SocioTipoHistorial"("socioTipoId");

-- CreateIndex
CREATE INDEX "SocioTipoHistorial_vigenciaDesde_idx" ON "SocioTipoHistorial"("vigenciaDesde");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_nroSocio_key" ON "Socio"("nroSocio");

-- CreateIndex
CREATE INDEX "Socio_socioTipoId_idx" ON "Socio"("socioTipoId");

-- CreateIndex
CREATE INDEX "Socio_estado_idx" ON "Socio"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "SocioCuota_socioId_mes_anio_key" ON "SocioCuota"("socioId", "mes", "anio");

-- CreateIndex
CREATE INDEX "SocioCuota_socioId_idx" ON "SocioCuota"("socioId");

-- CreateIndex
CREATE INDEX "SocioCuota_mes_anio_idx" ON "SocioCuota"("mes", "anio");

-- CreateIndex
CREATE INDEX "SocioPago_socioCuotaId_idx" ON "SocioPago"("socioCuotaId");

-- AddForeignKey
ALTER TABLE "SocioTipoHistorial" ADD CONSTRAINT "SocioTipoHistorial_socioTipoId_fkey" FOREIGN KEY ("socioTipoId") REFERENCES "SocioTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Socio" ADD CONSTRAINT "Socio_socioTipoId_fkey" FOREIGN KEY ("socioTipoId") REFERENCES "SocioTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioCuota" ADD CONSTRAINT "SocioCuota_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioPago" ADD CONSTRAINT "SocioPago_socioCuotaId_fkey" FOREIGN KEY ("socioCuotaId") REFERENCES "SocioCuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

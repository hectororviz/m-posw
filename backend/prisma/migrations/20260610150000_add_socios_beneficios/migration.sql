-- CreateTable
CREATE TABLE IF NOT EXISTS "SocioBeneficio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "socioTipoId" INTEGER NOT NULL,
    "categoriaProdId" UUID NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descuentoMaximo" DECIMAL(10,2),
    "limiteDiario" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocioBeneficio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocioCanje" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "socioBeneficioId" UUID NOT NULL,
    "socioId" INTEGER NOT NULL,
    "ventaId" UUID,
    "montoDescontado" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" UUID NOT NULL,
    "posId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocioCanje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SocioBeneficio_socioTipoId_categoriaProdId_key" ON "SocioBeneficio"("socioTipoId", "categoriaProdId");
CREATE INDEX IF NOT EXISTS "SocioBeneficio_socioTipoId_idx" ON "SocioBeneficio"("socioTipoId");
CREATE INDEX IF NOT EXISTS "SocioBeneficio_categoriaProdId_idx" ON "SocioBeneficio"("categoriaProdId");
CREATE INDEX IF NOT EXISTS "SocioCanje_socioBeneficioId_idx" ON "SocioCanje"("socioBeneficioId");
CREATE INDEX IF NOT EXISTS "SocioCanje_socioId_idx" ON "SocioCanje"("socioId");
CREATE INDEX IF NOT EXISTS "SocioCanje_fecha_idx" ON "SocioCanje"("fecha");

-- AddForeignKey
ALTER TABLE "SocioBeneficio" ADD CONSTRAINT "SocioBeneficio_socioTipoId_fkey" FOREIGN KEY ("socioTipoId") REFERENCES "SocioTipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocioBeneficio" ADD CONSTRAINT "SocioBeneficio_categoriaProdId_fkey" FOREIGN KEY ("categoriaProdId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocioCanje" ADD CONSTRAINT "SocioCanje_socioBeneficioId_fkey" FOREIGN KEY ("socioBeneficioId") REFERENCES "SocioBeneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocioCanje" ADD CONSTRAINT "SocioCanje_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

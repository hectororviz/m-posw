-- CreateTable
CREATE TABLE IF NOT EXISTS "AjusteAcreedor" (
    "id" SERIAL NOT NULL,
    "acreedorId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjusteAcreedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AjusteAcreedor_acreedorId_idx" ON "AjusteAcreedor"("acreedorId");

-- AddForeignKey
ALTER TABLE "AjusteAcreedor" ADD CONSTRAINT "AjusteAcreedor_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

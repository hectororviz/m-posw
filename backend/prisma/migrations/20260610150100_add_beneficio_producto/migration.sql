-- AlterTable: make categoriaProdId optional, add productoId
ALTER TABLE "SocioBeneficio" ALTER COLUMN "categoriaProdId" DROP NOT NULL;
ALTER TABLE "SocioBeneficio" ADD COLUMN IF NOT EXISTS "productoId" UUID;
ALTER TABLE "SocioBeneficio" ADD CONSTRAINT "SocioBeneficio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SocioBeneficio_socioTipoId_productoId_key" ON "SocioBeneficio"("socioTipoId", "productoId");
CREATE INDEX IF NOT EXISTS "SocioBeneficio_productoId_idx" ON "SocioBeneficio"("productoId");

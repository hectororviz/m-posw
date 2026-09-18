-- Interés semanal de acreedores: tasa configurable + comprobante auditable en AjusteAcreedor
ALTER TABLE "Acreedor" ADD COLUMN "tasaInteresMensual" DECIMAL(5,2);

ALTER TABLE "Setting" ADD COLUMN "interesAcreedoresHabilitado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Setting" ADD COLUMN "tasaInteresMensualAcreedores" DECIMAL(5,2);

ALTER TABLE "AjusteAcreedor" ADD COLUMN "esInteres" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AjusteAcreedor" ADD COLUMN "periodo" TEXT;
ALTER TABLE "AjusteAcreedor" ADD COLUMN "tasaMensualAplicada" DECIMAL(5,2);
ALTER TABLE "AjusteAcreedor" ADD COLUMN "baseCalculo" DECIMAL(10,2);

CREATE INDEX "AjusteAcreedor_acreedorId_periodo_idx" ON "AjusteAcreedor"("acreedorId", "periodo");

-- Fecha de amnistía única para intereses de acreedores (gracia 30d desde el aviso)
ALTER TABLE "Setting" ADD COLUMN "interesFechaAmnistia" TIMESTAMP(3);

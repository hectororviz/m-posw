ALTER TABLE "Socio" ADD COLUMN IF NOT EXISTS "uuid" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS "Socio_uuid_key" ON "Socio"("uuid");

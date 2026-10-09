-- Elimina por completo el módulo Ligas Deportivas.
--
-- Backup previo (externo al repo, antes de aplicar):
--   /home/ubuntu/m-posw-backups/ligas-backup-<timestamp>.sql
--   (contiene LigasConfig, permisos LIGAS y Setting.enableLigasModule)
-- Backup de código: rama backup/ligas-module-20261009 / tag pre-remove-ligas-20261009

-- 1) Tabla de configuración de ligas.
DROP TABLE IF EXISTS "LigasConfig";

-- 2) Toggle del módulo en Setting.
ALTER TABLE "Setting" DROP COLUMN IF EXISTS "enableLigasModule";

-- 3) Limpiar permisos/home de módulos eliminados. Además de LIGAS, se
--    descartan valores legacy (STOCK/WHATSAPP) que no existen en el schema.
DELETE FROM "UserModulePermission"
 WHERE module::text NOT IN (
   'POS', 'VENTAS', 'SOCIOS', 'TESORERIA', 'ACREEDORES', 'PRODUCTOS',
   'INTERNET', 'REPORTES', 'CONFIGURACION', 'PLAYERS', 'PATRIMONIO',
   'NOTIFICACIONES', 'ENTRADAS'
 );

UPDATE "User"
   SET "homeModule" = NULL
 WHERE "homeModule" IN ('LIGAS', 'STOCK', 'WHATSAPP');

UPDATE "User"
   SET "homeSmartphoneModule" = NULL
 WHERE "homeSmartphoneModule" IN ('LIGAS', 'STOCK', 'WHATSAPP');

-- 4) Recrear el enum ModuleKey sin LIGAS (Postgres no permite DROP VALUE).
ALTER TYPE "ModuleKey" RENAME TO "ModuleKey_old";

CREATE TYPE "ModuleKey" AS ENUM (
  'POS', 'VENTAS', 'SOCIOS', 'TESORERIA', 'ACREEDORES', 'PRODUCTOS',
  'INTERNET', 'REPORTES', 'CONFIGURACION', 'PLAYERS', 'PATRIMONIO',
  'NOTIFICACIONES', 'ENTRADAS'
);

ALTER TABLE "UserModulePermission"
  ALTER COLUMN "module" TYPE "ModuleKey"
  USING ("module"::text::"ModuleKey");

DROP TYPE "ModuleKey_old";

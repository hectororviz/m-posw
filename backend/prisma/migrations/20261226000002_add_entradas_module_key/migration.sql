-- Agrega ENTRADAS al enum ModuleKey.
-- Faltaba: el schema lo declaraba pero nunca se migro (drift). Sin esto,
-- Postgres rechaza UserModulePermission con module ENTRADAS (22P02 -> 500).
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'ENTRADAS';

ALTER TABLE "players" ALTER COLUMN "dni" DROP NOT NULL;
DROP INDEX "players_dni_key";
ALTER TABLE "player_categories" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

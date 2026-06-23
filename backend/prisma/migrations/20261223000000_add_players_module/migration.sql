-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'PLAYERS';

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F');
CREATE TYPE "AllowedSex" AS ENUM ('M', 'F', 'X');
CREATE TYPE "PlayerCategoryType" AS ENUM ('AGE', 'BIRTH_YEAR');

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "players_dni_key" ON "players"("dni");

-- CreateTable
CREATE TABLE "player_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "restrictionType" "PlayerCategoryType" NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "ageCutoffMonth" INTEGER DEFAULT 12,
    "ageCutoffDay" INTEGER DEFAULT 31,
    "birthYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "player_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allowedSex" "AllowedSex" NOT NULL,
    "birthYearMin" INTEGER,
    "birthYearMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_categories" (
    "tournamentId" INTEGER NOT NULL,
    "playerCategoryId" INTEGER NOT NULL,
    CONSTRAINT "tournament_categories_pkey" PRIMARY KEY ("tournamentId","playerCategoryId")
);

-- CreateTable
CREATE TABLE "tournament_players" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerCategoryId" INTEGER NOT NULL,
    "fichadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_players_playerId_tournamentId_key" ON "tournament_players"("playerId", "tournamentId");

-- AddForeignKey
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_playerCategoryId_fkey" FOREIGN KEY ("playerCategoryId") REFERENCES "player_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Setting
ALTER TABLE "Setting" ADD COLUMN "enablePlayersModule" BOOLEAN NOT NULL DEFAULT false;

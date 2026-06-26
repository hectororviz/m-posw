-- CreateTable
CREATE TABLE "coaches" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_coaches" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerCategoryId" INTEGER NOT NULL,
    "fichadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_coaches_tournamentId_playerCategoryId_key" ON "tournament_coaches"("tournamentId", "playerCategoryId");

-- AddForeignKey
ALTER TABLE "tournament_coaches" ADD CONSTRAINT "tournament_coaches_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_coaches" ADD CONSTRAINT "tournament_coaches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_coaches" ADD CONSTRAINT "tournament_coaches_playerCategoryId_fkey" FOREIGN KEY ("playerCategoryId") REFERENCES "player_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Repair constraints that were deferred because their parent tables were created by later migrations.

-- Ensure PATRIMONIO is in ModuleKey (patrimonio migration runs before add_username_and_permissions which creates the enum)
DO $$ BEGIN
  ALTER TYPE "ModuleKey" ADD VALUE 'PATRIMONIO';
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure tournament_coaches FKs exist (coaches migration runs before add_players_module which creates tournaments & player_categories)
DO $$ BEGIN
  ALTER TABLE "tournament_coaches" ADD CONSTRAINT "tournament_coaches_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tournament_coaches" ADD CONSTRAINT "tournament_coaches_playerCategoryId_fkey"
    FOREIGN KEY ("playerCategoryId") REFERENCES "player_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

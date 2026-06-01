-- CreateTable
CREATE TABLE "mp_city_mappings" (
    "zip_code" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "state_name" TEXT NOT NULL,
    "neighborhood_name" TEXT NOT NULL,
    "ml_city_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_city_mappings_pkey" PRIMARY KEY ("zip_code")
);

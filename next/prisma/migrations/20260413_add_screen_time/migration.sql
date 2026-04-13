-- CreateTable
CREATE TABLE "screen_time" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "categories" JSONB,
    "top_apps" JSONB,
    "pickups" INTEGER,
    "notifications" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screen_time_user_id_idx" ON "screen_time"("user_id");

-- CreateIndex
CREATE INDEX "screen_time_date_idx" ON "screen_time"("date");

-- CreateIndex
CREATE UNIQUE INDEX "screen_time_user_id_date_key" ON "screen_time"("user_id", "date");

-- AddForeignKey
ALTER TABLE "screen_time" ADD CONSTRAINT "screen_time_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

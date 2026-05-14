-- REV-20260512-067: Add missing FK indexes on user_id columns for 9 hot tables.
--
-- WithingsMeasurement и GarminBodyComposition exclude — у них composite PK
-- (user_id, date), что уже даёт btree index с лидирующим user_id колоном.
-- Дублирующий @@index([userId]) был бы redundant.
--
-- Indexes created CONCURRENTLY чтобы не блокировать prod таблицы.
-- ВНИМАНИЕ: CREATE INDEX CONCURRENTLY НЕЛЬЗЯ запускать внутри transaction —
-- Prisma migrate сам разворачивает миграции в BEGIN/COMMIT, поэтому эту
-- миграцию надо применять вручную (psql -1 без -1 / прямо в коннекшен)
-- ИЛИ применять не-CONCURRENTLY вариант на dev/staging.

CREATE INDEX IF NOT EXISTS "idx_recurring_transactions_user_id"
  ON "recurring_transactions" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_savings_goals_user_id"
  ON "savings_goals" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_shopping_items_user_id"
  ON "shopping_items" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_garmin_staging_user_id"
  ON "garmin_staging" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_embeddings_user_id"
  ON "embeddings" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_gym_sets_user_id"
  ON "gym_sets" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_gym_program_days_user_id"
  ON "gym_program_days" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_gym_program_exercises_user_id"
  ON "gym_program_exercises" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_sync_failures_user_id"
  ON "sync_failures" ("user_id");

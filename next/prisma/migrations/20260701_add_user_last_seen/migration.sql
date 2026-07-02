-- Track last activity timestamp per user, shown in /admin Users tab.
-- Updated on every authenticated request (throttled) via lib/current-user.ts.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen" timestamptz;

-- Backfill existing users from their most recent audit_log entry so the
-- admin table shows a value immediately instead of "—" until next visit.
UPDATE "users" u
SET "last_seen" = a.max_created
FROM (
  SELECT user_email, MAX(created_at) AS max_created
  FROM "audit_log"
  GROUP BY user_email
) a
WHERE a.user_email = u.email
  AND u.last_seen IS NULL;

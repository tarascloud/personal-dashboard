-- Nightly knowledge snapshot for Ollama `pd-assistant` model.
-- Driven by `/opt/docker/scripts/ollama-refresh.sh` on Mini (cron: 0 1 * * *).
-- The host script is the deployed copy; this file is the source-controlled
-- canonical version. After editing, copy to Mini:
--   scp deploy/ollama/ollama-refresh.sql mini:/opt/docker/scripts/ollama-refresh.sql
--
-- IMPORTANT: All `*.date` columns in PD are PostgreSQL native `date`.
-- Never cast a date expression to `text` (e.g. `(CURRENT_DATE - INTERVAL '30 days')::date::text`)
-- in a comparison against a `date` column — PG raises
-- "operator does not exist: date >= text". Use `::date` or omit the cast.
-- Regression history: REV-20260512-026 (this file was producing daily
-- 01:00 UTC pg errors from 2026-05-07 through 2026-05-11).
WITH finance AS (
  SELECT
    COALESCE(SUM(CASE WHEN type='INCOME' THEN amount_eur ELSE 0 END), 0) as income,
    COALESCE(SUM(CASE WHEN type='EXPENSE' THEN ABS(amount_eur) ELSE 0 END), 0) as expenses
  FROM transactions
  WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::date
),
categories AS (
  SELECT category, ROUND(SUM(ABS(amount_eur))::numeric, 0) as total
  FROM transactions
  WHERE type='EXPENSE' AND date >= (CURRENT_DATE - INTERVAL '30 days')::date AND category IS NOT NULL
  GROUP BY category ORDER BY total DESC LIMIT 10
),
balances AS (
  SELECT account, ROUND(SUM(amount_eur)::numeric, 2) as balance
  FROM transactions
  WHERE account IS NOT NULL
  GROUP BY account
  HAVING ABS(SUM(amount_eur)) > 1
),
budget_progress AS (
  SELECT b.category,
    ROUND(b.amount_eur::numeric, 0) as budget,
    COALESCE(ROUND(SUM(ABS(t.amount_eur))::numeric, 0), 0) as spent
  FROM budgets b
  LEFT JOIN transactions t ON t.category = b.category
    AND t.type = 'EXPENSE'
    AND t.date >= DATE_TRUNC('month', CURRENT_DATE)::date
    AND t.date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
    AND t.user_id = b.user_id
  WHERE b.active = true
  GROUP BY b.category, b.amount_eur
),
health AS (
  SELECT date,
    steps, ROUND(sleep_seconds/3600.0, 1) as sleep_hours,
    resting_hr, avg_stress, sleep_score, hrv_last_night
  FROM garmin_daily
  WHERE date >= (CURRENT_DATE - INTERVAL '7 days')::date
  ORDER BY date DESC LIMIT 7
),
weight AS (
  SELECT date, weight, body_fat_pct
  FROM garmin_body_composition
  ORDER BY date DESC LIMIT 1
),
workouts AS (
  SELECT w.date, w.workout_name, w.duration_minutes,
    COUNT(DISTINCT we.exercise_id) as exercise_count
  FROM gym_workouts w
  LEFT JOIN gym_workout_exercises we ON we.workout_id = w.id
  GROUP BY w.id, w.date, w.workout_name, w.duration_minutes
  ORDER BY w.date DESC LIMIT 5
),
food AS (
  SELECT date,
    ROUND(SUM(calories)::numeric, 0) as total_cal,
    ROUND(SUM(protein_g)::numeric, 0) as total_protein
  FROM food_log
  WHERE date >= (CURRENT_DATE - INTERVAL '7 days')::date
  GROUP BY date ORDER BY date DESC
)
SELECT json_build_object(
  'date', CURRENT_DATE,
  'finance', (SELECT json_build_object('income', income, 'expenses', expenses, 'net', income - expenses) FROM finance),
  'top_categories', (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]') FROM categories),
  'accounts', (SELECT COALESCE(json_agg(json_build_object('account', account, 'balance', balance)), '[]') FROM balances),
  'budgets', (SELECT COALESCE(json_agg(json_build_object('category', category, 'budget', budget, 'spent', spent)), '[]') FROM budget_progress),
  'health', (SELECT COALESCE(json_agg(json_build_object('date', date, 'steps', steps, 'sleep_hours', sleep_hours, 'resting_hr', resting_hr, 'stress', avg_stress, 'sleep_score', sleep_score, 'hrv', hrv_last_night)), '[]') FROM health),
  'weight', (SELECT json_build_object('date', date, 'kg', weight, 'fat_pct', body_fat_pct) FROM weight),
  'workouts', (SELECT COALESCE(json_agg(json_build_object('date', date, 'name', workout_name, 'duration', duration_minutes, 'exercises', exercise_count)), '[]') FROM workouts),
  'food', (SELECT COALESCE(json_agg(json_build_object('date', date, 'calories', total_cal, 'protein_g', total_protein)), '[]') FROM food)
)::text;

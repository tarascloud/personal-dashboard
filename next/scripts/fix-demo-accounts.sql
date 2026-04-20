-- Fix demo accounts: rename, add mono/bunq, fix balances, add cycling/running
-- Demo user ID: 748

BEGIN;

-- ============================================================================
-- 1. RENAME ACCOUNTS
-- ============================================================================

-- Delete old accounts
DELETE FROM custom_accounts WHERE user_id = 748;

-- Create new accounts
INSERT INTO custom_accounts (name, currency, is_active, sort_order, initial_balance, user_id) VALUES
  ('Mono USD',      '$', 1, 1, 2000, 748),
  ('Mono EUR',      '€', 1, 2, 5000, 748),
  ('Mono UAH',      '₴', 1, 3, 50000, 748),
  ('Mono Savings',  '€', 1, 4, 15000, 748),
  ('bunq',          '€', 1, 5, 3000, 748),
  ('Cash',          '€', 1, 6, 200, 748);

-- ============================================================================
-- 2. UPDATE TRANSACTIONS — rename accounts
-- ============================================================================

-- Main salary/expenses account: Alex ING → bunq
UPDATE transactions SET account = 'bunq' WHERE user_id = 748 AND account = 'Alex ING';

-- Secondary: Alex Revolut → Mono EUR
UPDATE transactions SET account = 'Mono EUR' WHERE user_id = 748 AND account = 'Alex Revolut';

-- Partner: Partner N26 → Mono UAH (change currency too)
UPDATE transactions SET account = 'Mono UAH', currency_original = '₴' WHERE user_id = 748 AND account = 'Partner N26';

-- Cash stays
UPDATE transactions SET account = 'Cash' WHERE user_id = 748 AND account = 'Alex Cash';

-- ============================================================================
-- 3. ADD SOME SAVINGS TRANSFERS (to make Mono Savings positive)
-- ============================================================================

-- Monthly savings transfers from bunq to Mono Savings (last 3 years)
DO $$
DECLARE
  m DATE;
  amt FLOAT;
BEGIN
  m := '2023-01-01'::DATE;
  WHILE m <= '2026-03-01'::DATE LOOP
    amt := 200 + random() * 300;  -- 200-500 EUR per month
    -- Transfer out from bunq
    INSERT INTO transactions (date, year, month, type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (m + (floor(random()*5)::INT || ' days')::INTERVAL)::DATE::TEXT,
      EXTRACT(YEAR FROM m)::INT, EXTRACT(MONTH FROM m)::INT,
      'EXPENSE', 'bunq', 'Transfer → Mono Savings',
      ROUND(amt::NUMERIC, 2), '€', ROUND(amt::NUMERIC, 2),
      'Monthly savings', 'manual', 748
    );
    -- Transfer in to Mono Savings
    INSERT INTO transactions (date, year, month, type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (m + (floor(random()*5)::INT || ' days')::INTERVAL)::DATE::TEXT,
      EXTRACT(YEAR FROM m)::INT, EXTRACT(MONTH FROM m)::INT,
      'INCOME', 'Mono Savings', 'Transfer ← bunq',
      ROUND(amt::NUMERIC, 2), '€', ROUND(amt::NUMERIC, 2),
      'Monthly savings', 'manual', 748
    );
    m := m + INTERVAL '1 month';
  END LOOP;
END $$;

-- Add some USD income to Mono USD
DO $$
DECLARE
  m DATE;
  amt FLOAT;
BEGIN
  m := '2023-06-01'::DATE;
  WHILE m <= '2026-03-01'::DATE LOOP
    IF random() < 0.4 THEN  -- ~40% of months
      amt := 500 + random() * 2000;
      INSERT INTO transactions (date, year, month, type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (m + (floor(random()*25)::INT || ' days')::INTERVAL)::DATE::TEXT,
        EXTRACT(YEAR FROM m)::INT, EXTRACT(MONTH FROM m)::INT,
        'INCOME', 'Mono USD', 'Freelance',
        ROUND(amt::NUMERIC, 2), '$', ROUND((amt * 0.92)::NUMERIC, 2),
        'Contract payment USD', 'manual', 748
      );
    END IF;
    m := m + INTERVAL '1 month';
  END LOOP;
END $$;

-- ============================================================================
-- 4. UPDATE RECURRING TRANSACTIONS
-- ============================================================================
UPDATE recurring_transactions SET account = 'bunq' WHERE user_id = 748 AND account = 'Alex ING';

-- ============================================================================
-- 5. ADD CYCLING & RUNNING WORKOUTS (1-2 per week)
-- ============================================================================

-- First, add cycling and running exercises if not exist
INSERT INTO gym_exercises (name, name_ua, muscle_group, secondary_muscles, equipment, exercise_type, recovery_hours, user_id, is_custom)
VALUES
  ('Road Cycling', 'Велосипед (шосе)', 'Quadriceps', 'Hamstrings,Calves,Glutes', 'None', 'cardio', 24, 748, 1),
  ('Running', 'Біг', 'Quadriceps', 'Hamstrings,Calves,Glutes,Core', 'None', 'cardio', 24, 748, 1)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  d DATE;
  workout_id INT;
  cycling_ex_id INT;
  running_ex_id INT;
  we_id INT;
  duration_min INT;
  distance_km FLOAT;
  avg_hr INT;
  workout_type TEXT;
BEGIN
  -- Get exercise IDs
  SELECT id INTO cycling_ex_id FROM gym_exercises WHERE name = 'Road Cycling' AND user_id = 748;
  SELECT id INTO running_ex_id FROM gym_exercises WHERE name = 'Running' AND user_id = 748;

  d := '2021-06-01'::DATE;  -- start cycling/running from summer 2021

  WHILE d <= '2026-03-14'::DATE LOOP
    -- Tuesday: cycling or running (75% chance)
    IF EXTRACT(DOW FROM d) = 2 AND random() < 0.75 THEN
      IF random() < 0.6 THEN
        workout_type := 'cycling';
      ELSE
        workout_type := 'running';
      END IF;

      IF workout_type = 'cycling' THEN
        duration_min := 45 + floor(random() * 60)::INT;  -- 45-105 min
        distance_km := duration_min * (0.35 + random() * 0.15);  -- ~20-35 km/h avg
        avg_hr := 130 + floor(random() * 25)::INT;
      ELSE
        duration_min := 25 + floor(random() * 35)::INT;  -- 25-60 min
        distance_km := duration_min * (0.14 + random() * 0.04);  -- ~8-11 km/h
        avg_hr := 140 + floor(random() * 20)::INT;
      END IF;

      INSERT INTO gym_workouts (date, duration_minutes, notes, user_id)
      VALUES (d, duration_min,
        CASE WHEN workout_type = 'cycling'
          THEN 'Cycling ' || ROUND(distance_km::NUMERIC, 1) || 'km, avg HR ' || avg_hr
          ELSE 'Running ' || ROUND(distance_km::NUMERIC, 1) || 'km, avg HR ' || avg_hr
        END,
        748)
      RETURNING id INTO workout_id;

      INSERT INTO gym_workout_exercises (workout_id, exercise_id, order_num, user_id)
      VALUES (workout_id,
        CASE WHEN workout_type = 'cycling' THEN cycling_ex_id ELSE running_ex_id END,
        1, 748)
      RETURNING id INTO we_id;

      -- Add a single "set" representing the cardio session
      INSERT INTO gym_sets (workout_exercise_id, set_num, reps, weight_kg, user_id)
      VALUES (we_id, 1, duration_min, distance_km, 748);
    END IF;

    -- Saturday: cycling or running (50% chance, more in summer)
    IF EXTRACT(DOW FROM d) = 6 AND random() < (CASE WHEN EXTRACT(MONTH FROM d) BETWEEN 4 AND 10 THEN 0.65 ELSE 0.3 END) THEN
      IF random() < 0.5 THEN
        workout_type := 'cycling';
      ELSE
        workout_type := 'running';
      END IF;

      IF workout_type = 'cycling' THEN
        duration_min := 60 + floor(random() * 90)::INT;  -- longer weekend rides
        distance_km := duration_min * (0.35 + random() * 0.15);
        avg_hr := 125 + floor(random() * 25)::INT;
      ELSE
        duration_min := 30 + floor(random() * 40)::INT;
        distance_km := duration_min * (0.14 + random() * 0.04);
        avg_hr := 135 + floor(random() * 20)::INT;
      END IF;

      INSERT INTO gym_workouts (date, duration_minutes, notes, user_id)
      VALUES (d, duration_min,
        CASE WHEN workout_type = 'cycling'
          THEN 'Weekend ride ' || ROUND(distance_km::NUMERIC, 1) || 'km'
          ELSE 'Weekend run ' || ROUND(distance_km::NUMERIC, 1) || 'km'
        END,
        748)
      RETURNING id INTO workout_id;

      INSERT INTO gym_workout_exercises (workout_id, exercise_id, order_num, user_id)
      VALUES (workout_id,
        CASE WHEN workout_type = 'cycling' THEN cycling_ex_id ELSE running_ex_id END,
        1, 748)
      RETURNING id INTO we_id;

      INSERT INTO gym_sets (workout_exercise_id, set_num, reps, weight_kg, user_id)
      VALUES (we_id, 1, duration_min, distance_km, 748);
    END IF;

    d := d + INTERVAL '1 day';
  END LOOP;

  RAISE NOTICE 'Cycling & running workouts added';
END $$;

COMMIT;

-- Verify
SELECT account, currency_original, count(*), ROUND(SUM(amount_eur)::NUMERIC, 0) as balance
FROM transactions WHERE user_id = 748
GROUP BY account, currency_original ORDER BY account;

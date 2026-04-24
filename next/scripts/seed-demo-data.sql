-- ============================================================================
-- seed-demo-data.sql
-- Populate demo data for user_id = 748 (Alex)
-- Covers 5 years: 2021-03-15 to 2026-03-15
-- Safe to run multiple times (deletes demo user data first)
-- ============================================================================

-- ============================================================================
-- 0. CLEANUP: Remove all existing demo user data
-- ============================================================================
DELETE FROM gym_sets WHERE user_id = 748;
DELETE FROM gym_workout_exercises WHERE user_id = 748;
DELETE FROM gym_workouts WHERE user_id = 748;
DELETE FROM gym_program_exercises WHERE user_id = 748;
DELETE FROM gym_program_days WHERE user_id = 748;
DELETE FROM gym_programs WHERE user_id = 748;
DELETE FROM gym_exercises WHERE user_id = 748;
DELETE FROM transactions WHERE user_id = 748;
DELETE FROM custom_accounts WHERE user_id = 748;
DELETE FROM custom_categories WHERE user_id = 748;
DELETE FROM category_favourites WHERE user_id = 748;
DELETE FROM budgets WHERE user_id = 748;
DELETE FROM budget_config WHERE user_id = 748;
DELETE FROM mandatory_categories WHERE user_id = 748;
DELETE FROM recurring_transactions WHERE user_id = 748;
DELETE FROM savings_goals WHERE user_id = 748;
DELETE FROM daily_log WHERE user_id = 748;
DELETE FROM shopping_items WHERE user_id = 748;
DELETE FROM shopping_history WHERE user_id = 748;
DELETE FROM garmin_daily WHERE user_id = 748;
DELETE FROM garmin_sleep WHERE user_id = 748;
DELETE FROM garmin_body_composition WHERE user_id = 748;
DELETE FROM withings_measurements WHERE user_id = 748;
DELETE FROM ai_notes WHERE user_id = 748;
DELETE FROM food_log WHERE user_id = 748;

-- ============================================================================
-- 1. CUSTOM ACCOUNTS
-- ============================================================================
INSERT INTO custom_accounts (name, currency, is_active, sort_order, initial_balance, user_id)
VALUES
  ('Alex ING',      'EUR', true, 1, 500,  748),
  ('Alex Revolut',  'EUR', true, 2, 100,  748),
  ('Alex Cash',     'EUR', true, 3, 50,   748),
  ('Partner N26',   'EUR', true, 4, 200,  748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CUSTOM CATEGORIES (expense categories for demo user)
-- ============================================================================
INSERT INTO custom_categories (category, user_id)
VALUES
  ('Rent', 748),
  ('Groceries', 748),
  ('Restaurants', 748),
  ('Transport', 748),
  ('Utilities', 748),
  ('Entertainment', 748),
  ('Healthcare', 748),
  ('Clothing', 748),
  ('Subscriptions', 748),
  ('Travel', 748),
  ('Salary', 748),
  ('Freelance', 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. TRANSACTIONS (~10,000+ records over 5 years)
-- ============================================================================
DO $$
DECLARE
  d DATE;
  m_start DATE := '2021-03-01';
  m_end DATE := '2026-03-01';
  cur_month DATE;
  progress FLOAT;          -- 0.0 to 1.0 over 5 years
  total_months INT;
  month_idx INT;
  -- base amounts (start -> end)
  salary_base FLOAT;
  rent_base FLOAT;
  groceries_base FLOAT;
  restaurants_base FLOAT;
  transport_base FLOAT;
  utilities_base FLOAT;
  entertainment_base FLOAT;
  healthcare_base FLOAT;
  clothing_base FLOAT;
  subscriptions_base FLOAT;
  -- variation
  var FLOAT;
  rand_day INT;
  rand_val FLOAT;
  -- accounts
  main_accounts TEXT[] := ARRAY['Alex ING', 'Alex Revolut'];
  expense_account TEXT;
  i INT;
  ex_count INT;
  sub_amount FLOAT;
BEGIN
  total_months := (EXTRACT(YEAR FROM m_end) - EXTRACT(YEAR FROM m_start)) * 12
                + (EXTRACT(MONTH FROM m_end) - EXTRACT(MONTH FROM m_start));

  cur_month := m_start;
  month_idx := 0;

  WHILE cur_month <= m_end LOOP
    progress := month_idx::FLOAT / GREATEST(total_months, 1);

    -- Salary: 400 -> 5000 (exponential-ish growth)
    salary_base := 400 + (5000 - 400) * power(progress, 0.7);
    -- Rent: 800 -> 1000
    rent_base := 800 + (1000 - 800) * progress;
    -- Groceries: 150 -> 400
    groceries_base := 150 + (400 - 150) * progress;
    -- Restaurants: 30 -> 150
    restaurants_base := 30 + (150 - 30) * progress;
    -- Transport: 40 -> 80
    transport_base := 40 + (80 - 40) * progress;
    -- Utilities: 50 -> 100
    utilities_base := 50 + (100 - 50) * progress;
    -- Entertainment: 20 -> 80
    entertainment_base := 20 + (80 - 20) * progress;
    -- Healthcare: 20 -> 50
    healthcare_base := 20 + (50 - 20) * progress;
    -- Clothing: 30 -> 80
    clothing_base := 30 + (80 - 30) * progress;
    -- Subscriptions: 15 -> 50
    subscriptions_base := 15 + (50 - 15) * progress;

    -- ====== INCOME: Salary (1st of month) ======
    var := 1.0 + (random() - 0.5) * 0.06;  -- +/- 3% for salary
    INSERT INTO transactions (date, year, month, type, sub_type, account, category,
      amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (cur_month + INTERVAL '0 days')::DATE,
      EXTRACT(YEAR FROM cur_month)::INT,
      EXTRACT(MONTH FROM cur_month)::INT,
      'INCOME', NULL, 'Alex ING', 'Salary',
      ROUND((salary_base * var)::NUMERIC, 2),
      'EUR',
      ROUND((salary_base * var)::NUMERIC, 2),
      'Monthly salary - TechCorp',
      'manual', 748
    );

    -- ====== INCOME: Freelance (occasional, ~30% chance) ======
    IF random() < 0.3 THEN
      rand_day := 10 + floor(random() * 18)::INT;
      rand_val := (100 + random() * 900) * (0.5 + progress);
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'INCOME', NULL, 'Alex Revolut', 'Freelance',
        ROUND(rand_val::NUMERIC, 2),
        'EUR',
        ROUND(rand_val::NUMERIC, 2),
        'Freelance project payment',
        'manual', 748
      );
    END IF;

    -- ====== EXPENSE: Rent (1st of month) ======
    var := 1.0;
    INSERT INTO transactions (date, year, month, type, sub_type, account, category,
      amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (cur_month + INTERVAL '0 days')::DATE,
      EXTRACT(YEAR FROM cur_month)::INT,
      EXTRACT(MONTH FROM cur_month)::INT,
      'EXPENSE', NULL, 'Alex ING', 'Rent',
      ROUND((rent_base)::NUMERIC, 2),
      'EUR',
      ROUND((rent_base)::NUMERIC, 2),
      'Apartment rent',
      'manual', 748
    );

    -- ====== EXPENSE: Groceries (6-12 transactions per month) ======
    ex_count := 6 + floor(random() * 7)::INT;
    FOR i IN 1..ex_count LOOP
      rand_day := floor(random() * 28)::INT;
      sub_amount := (groceries_base / ex_count) * (0.5 + random());
      expense_account := main_accounts[1 + floor(random() * 2)::INT];
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, expense_account, 'Groceries',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['Albert Heijn', 'Lidl', 'Jumbo', 'Aldi', 'PLUS', 'Dirk'])[1 + floor(random() * 6)::INT],
        'manual', 748
      );
    END LOOP;

    -- ====== EXPENSE: Restaurants (2-5 per month) ======
    ex_count := 2 + floor(random() * 4)::INT;
    FOR i IN 1..ex_count LOOP
      rand_day := floor(random() * 28)::INT;
      sub_amount := (restaurants_base / ex_count) * (0.6 + random() * 0.8);
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex Revolut', 'Restaurants',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['Pizza place', 'Sushi bar', 'Thai takeaway', 'Burger joint', 'Indian restaurant', 'Cafe brunch'])[1 + floor(random() * 6)::INT],
        'manual', 748
      );
    END LOOP;

    -- ====== EXPENSE: Transport (2-4 per month) ======
    ex_count := 2 + floor(random() * 3)::INT;
    FOR i IN 1..ex_count LOOP
      rand_day := floor(random() * 28)::INT;
      sub_amount := (transport_base / ex_count) * (0.7 + random() * 0.6);
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex ING', 'Transport',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['NS train ticket', 'OV-chipkaart top-up', 'Uber ride', 'Fuel', 'Parking'])[1 + floor(random() * 5)::INT],
        'manual', 748
      );
    END LOOP;

    -- ====== EXPENSE: Utilities (1 per month) ======
    var := 1.0 + (random() - 0.5) * 0.2;
    INSERT INTO transactions (date, year, month, type, sub_type, account, category,
      amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (cur_month + INTERVAL '4 days')::DATE,
      EXTRACT(YEAR FROM cur_month)::INT,
      EXTRACT(MONTH FROM cur_month)::INT,
      'EXPENSE', NULL, 'Alex ING', 'Utilities',
      ROUND((utilities_base * var)::NUMERIC, 2),
      'EUR',
      ROUND((utilities_base * var)::NUMERIC, 2),
      'Electricity + Gas + Water',
      'manual', 748
    );

    -- ====== EXPENSE: Entertainment (1-3 per month) ======
    ex_count := 1 + floor(random() * 3)::INT;
    FOR i IN 1..ex_count LOOP
      rand_day := floor(random() * 28)::INT;
      sub_amount := (entertainment_base / ex_count) * (0.6 + random() * 0.8);
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex Revolut', 'Entertainment',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['Cinema tickets', 'Concert', 'Board games', 'Bowling', 'Museum visit', 'Escape room'])[1 + floor(random() * 6)::INT],
        'manual', 748
      );
    END LOOP;

    -- ====== EXPENSE: Healthcare (0-2 per month) ======
    ex_count := floor(random() * 3)::INT;
    FOR i IN 1..ex_count LOOP
      rand_day := floor(random() * 28)::INT;
      sub_amount := healthcare_base * (0.5 + random());
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex ING', 'Healthcare',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['Pharmacy', 'Doctor visit', 'Dentist', 'Vitamins', 'Health insurance copay'])[1 + floor(random() * 5)::INT],
        'manual', 748
      );
    END LOOP;

    -- ====== EXPENSE: Clothing (0-2 per month) ======
    IF random() < 0.6 THEN
      rand_day := floor(random() * 28)::INT;
      sub_amount := clothing_base * (0.5 + random());
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex Revolut', 'Clothing',
        ROUND(sub_amount::NUMERIC, 2),
        'EUR',
        ROUND(sub_amount::NUMERIC, 2),
        (ARRAY['H&M', 'Zara', 'UNIQLO', 'Decathlon', 'Online order', 'Thrift store'])[1 + floor(random() * 6)::INT],
        'manual', 748
      );
    END IF;

    -- ====== EXPENSE: Subscriptions (1 per month) ======
    INSERT INTO transactions (date, year, month, type, sub_type, account, category,
      amount_original, currency_original, amount_eur, description, source, user_id)
    VALUES (
      (cur_month + INTERVAL '2 days')::DATE,
      EXTRACT(YEAR FROM cur_month)::INT,
      EXTRACT(MONTH FROM cur_month)::INT,
      'EXPENSE', NULL, 'Alex ING', 'Subscriptions',
      ROUND(subscriptions_base::NUMERIC, 2),
      'EUR',
      ROUND(subscriptions_base::NUMERIC, 2),
      'Netflix + Spotify + iCloud',
      'manual', 748
    );

    -- ====== EXPENSE: Travel (occasional, ~15% chance, seasonal bias) ======
    IF random() < 0.15
       OR (EXTRACT(MONTH FROM cur_month) IN (6,7,8,12) AND random() < 0.35) THEN
      rand_day := floor(random() * 20)::INT + 5;
      rand_val := 200 + random() * 1300;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category,
        amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (
        (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
        EXTRACT(YEAR FROM cur_month)::INT,
        EXTRACT(MONTH FROM cur_month)::INT,
        'EXPENSE', NULL, 'Alex Revolut', 'Travel',
        ROUND(rand_val::NUMERIC, 2),
        'EUR',
        ROUND(rand_val::NUMERIC, 2),
        (ARRAY['Flight tickets', 'Airbnb booking', 'Hotel stay', 'Train trip', 'Car rental', 'Travel insurance'])[1 + floor(random() * 6)::INT],
        'manual', 748
      );
    END IF;

    -- ====== Partner expenses (from Partner N26 account, ~40% of months) ======
    IF random() < 0.4 THEN
      ex_count := 1 + floor(random() * 3)::INT;
      FOR i IN 1..ex_count LOOP
        rand_day := floor(random() * 28)::INT;
        sub_amount := 20 + random() * 120;
        INSERT INTO transactions (date, year, month, type, sub_type, account, category,
          amount_original, currency_original, amount_eur, description, source, user_id)
        VALUES (
          (cur_month + (rand_day || ' days')::INTERVAL)::DATE,
          EXTRACT(YEAR FROM cur_month)::INT,
          EXTRACT(MONTH FROM cur_month)::INT,
          'EXPENSE', NULL, 'Partner N26',
          (ARRAY['Groceries', 'Restaurants', 'Entertainment', 'Healthcare'])[1 + floor(random() * 4)::INT],
          ROUND(sub_amount::NUMERIC, 2),
          'EUR',
          ROUND(sub_amount::NUMERIC, 2),
          'Partner expense',
          'manual', 748
        );
      END LOOP;
    END IF;

    cur_month := cur_month + INTERVAL '1 month';
    month_idx := month_idx + 1;
  END LOOP;

  RAISE NOTICE 'Transactions generated: % months processed', month_idx;
END $$;

-- ============================================================================
-- 4. BUDGETS
-- ============================================================================
INSERT INTO budgets (category, amount_eur, month, active, user_id)
VALUES
  ('Groceries',     400, NULL, true, 748),
  ('Restaurants',   150, NULL, true, 748),
  ('Entertainment',  80, NULL, true, 748),
  ('Transport',      80, NULL, true, 748),
  ('Clothing',       80, NULL, true, 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. BUDGET CONFIG
-- ============================================================================
INSERT INTO budget_config (user_id, limit_type, limit_value)
VALUES (748, 'fixed', 2000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. MANDATORY CATEGORIES
-- ============================================================================
INSERT INTO mandatory_categories (user_id, category)
VALUES
  (748, 'Rent'),
  (748, 'Utilities'),
  (748, 'Subscriptions')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. RECURRING TRANSACTIONS
-- ============================================================================
INSERT INTO recurring_transactions (name, amount_eur, category, tx_type, account, day_of_month, active, user_id)
VALUES
  ('Apartment rent',     1000, 'Rent',          'EXPENSE', 'Alex ING', 1, true, 748),
  ('Utilities',           100, 'Utilities',     'EXPENSE', 'Alex ING', 5, true, 748),
  ('Subscriptions',        50, 'Subscriptions', 'EXPENSE', 'Alex ING', 3, true, 748),
  ('Salary',             5000, 'Salary',        'INCOME',  'Alex ING', 1, true, 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. SAVINGS GOALS
-- ============================================================================
INSERT INTO savings_goals (name, target_eur, current_eur, deadline, active, user_id)
VALUES
  ('Emergency fund',  10000, 6500, '2026-12-31', true, 748),
  ('Vacation fund',    3000, 1200, '2026-08-01', true, 748),
  ('New laptop',       2000,  800, '2026-06-01', true, 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. DAILY LOG (~1800 records)
-- ============================================================================
DO $$
DECLARE
  d DATE;
  level_val FLOAT := 0;
  mood_val INT;
  energy_val INT;
  stress_val INT;
  focus_val INT;
  alcohol_val INT;
  caffeine_val INT;
  kids_val FLOAT;
  day_of_week INT;
BEGIN
  FOR d IN SELECT generate_series('2021-03-15'::DATE, '2026-03-15'::DATE, '1 day')::DATE LOOP
    -- Skip ~10% of days
    IF random() < 0.10 THEN
      CONTINUE;
    END IF;

    day_of_week := EXTRACT(DOW FROM d)::INT;  -- 0=Sun, 6=Sat

    -- Level: random walk between -3 and +3
    level_val := level_val + (random() - 0.5) * 1.2;
    level_val := GREATEST(-3, LEAST(3, level_val));
    -- Slight positive bias on weekends
    IF day_of_week IN (0, 6) THEN
      level_val := level_val + 0.1;
      level_val := LEAST(3, level_val);
    END IF;

    -- Mood delta: -3 to 3
    mood_val := floor(random() * 7 - 3)::INT;

    -- Energy: 1-5 (weekdays slightly lower)
    energy_val := CASE WHEN day_of_week IN (0, 6)
      THEN 2 + floor(random() * 4)::INT
      ELSE 1 + floor(random() * 4)::INT
    END;
    energy_val := GREATEST(1, LEAST(5, energy_val));

    -- Stress: 1-5
    stress_val := CASE WHEN day_of_week IN (0, 6)
      THEN 1 + floor(random() * 3)::INT
      ELSE 1 + floor(random() * 5)::INT
    END;
    stress_val := GREATEST(1, LEAST(5, stress_val));

    -- Focus: 1-5
    focus_val := 2 + floor(random() * 4)::INT;
    focus_val := GREATEST(1, LEAST(5, focus_val));

    -- Alcohol: 0 or 1, mostly weekends
    alcohol_val := CASE
      WHEN day_of_week IN (5, 6) AND random() < 0.5 THEN 1
      WHEN random() < 0.1 THEN 1
      ELSE 0
    END;

    -- Caffeine: 1-3
    caffeine_val := 1 + floor(random() * 3)::INT;

    -- Kids hours: 0-4, only after 2023
    kids_val := CASE
      WHEN d >= '2023-01-01' THEN ROUND((random() * 4)::NUMERIC, 1)
      ELSE NULL
    END;

    INSERT INTO daily_log (date, level, mood_delta, energy_level, stress_level,
      focus_quality, alcohol, caffeine, kids_hours, user_id)
    VALUES (
      d,
      ROUND(level_val::NUMERIC, 2),
      mood_val,
      energy_val,
      stress_val,
      focus_val,
      alcohol_val,
      caffeine_val,
      kids_val,
      748
    )
    ON CONFLICT (user_id, date) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Daily log records generated for demo user';
END $$;

-- ============================================================================
-- 10. COPY GYM EXERCISES FROM TARAS (user_id = 1)
-- ============================================================================
INSERT INTO gym_exercises (user_id, name, muscle_group, secondary_muscles,
  equipment, exercise_type, force_type, level, description, is_custom,
  recovery_hours, name_ua, is_favourite)
SELECT
  748, name, muscle_group, secondary_muscles,
  equipment, exercise_type, force_type, level, description, is_custom,
  recovery_hours, name_ua, is_favourite
FROM gym_exercises
WHERE user_id = 1
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================================
-- 11. GYM WORKOUTS (~500 records, 3-4 times per week over 5 years)
-- ============================================================================
DO $$
DECLARE
  d DATE;
  workout_id INT;
  exercise_ids INT[];
  chosen_exercises INT[];
  we_id INT;
  num_exercises INT;
  num_sets INT;
  base_weight FLOAT;
  weight_progress FLOAT;
  workout_day_of_week INT;
  i INT;
  j INT;
  workout_count INT := 0;
  workout_names TEXT[] := ARRAY['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Lower Body', 'Full Body'];
  program_types TEXT[] := ARRAY['PPL', 'Upper/Lower', 'Full Body'];
BEGIN
  -- Get exercise IDs for demo user
  SELECT array_agg(id) INTO exercise_ids
  FROM gym_exercises
  WHERE user_id = 748;

  -- If no exercises were copied, skip
  IF exercise_ids IS NULL OR array_length(exercise_ids, 1) IS NULL THEN
    RAISE NOTICE 'No gym exercises found for user 748, skipping workouts';
    RETURN;
  END IF;

  FOR d IN SELECT generate_series('2021-03-15'::DATE, '2026-03-15'::DATE, '1 day')::DATE LOOP
    workout_day_of_week := EXTRACT(DOW FROM d)::INT;

    -- Train Mon(1), Wed(3), Fri(5), and sometimes Sat(6)
    IF workout_day_of_week NOT IN (1, 3, 5) THEN
      IF workout_day_of_week = 6 AND random() < 0.3 THEN
        NULL; -- proceed with Saturday workout
      ELSE
        CONTINUE;
      END IF;
    END IF;

    -- Skip ~8% of training days (rest, sick, etc.)
    IF random() < 0.08 THEN
      CONTINUE;
    END IF;

    -- Weight progress factor (0 -> 1 over 5 years)
    weight_progress := (d - '2021-03-15'::DATE)::FLOAT / (365.25 * 5);

    -- Create workout
    INSERT INTO gym_workouts (user_id, date, start_time, end_time, program_type,
      workout_name, duration_minutes)
    VALUES (
      748,
      d,
      (CASE WHEN random() < 0.5 THEN '07:' ELSE '18:' END || LPAD((floor(random() * 60)::INT)::TEXT, 2, '0')),
      NULL,
      program_types[1 + floor(random() * array_length(program_types, 1))::INT],
      workout_names[1 + floor(random() * array_length(workout_names, 1))::INT],
      45 + floor(random() * 45)::INT
    )
    RETURNING id INTO workout_id;

    -- 4-6 exercises per workout
    num_exercises := 4 + floor(random() * 3)::INT;
    num_exercises := LEAST(num_exercises, array_length(exercise_ids, 1));

    -- Pick random exercises (simple shuffle pick)
    chosen_exercises := ARRAY[]::INT[];
    WHILE array_length(chosen_exercises, 1) IS NULL
          OR array_length(chosen_exercises, 1) < num_exercises LOOP
      i := exercise_ids[1 + floor(random() * array_length(exercise_ids, 1))::INT];
      IF NOT (i = ANY(chosen_exercises)) THEN
        chosen_exercises := chosen_exercises || i;
      END IF;
    END LOOP;

    FOR i IN 1..num_exercises LOOP
      -- Create workout exercise
      INSERT INTO gym_workout_exercises (user_id, workout_id, exercise_id, order_num)
      VALUES (748, workout_id, chosen_exercises[i], i)
      RETURNING id INTO we_id;

      -- 3-4 sets per exercise
      num_sets := 3 + floor(random() * 2)::INT;
      -- Base weight increases with progress
      base_weight := 10 + random() * 30 + weight_progress * 40;

      FOR j IN 1..num_sets LOOP
        INSERT INTO gym_sets (user_id, workout_exercise_id, set_num, weight_kg, reps,
          is_warmup, is_failure, rest_seconds, intensity)
        VALUES (
          748,
          we_id,
          j,
          ROUND((base_weight * (0.9 + random() * 0.2))::NUMERIC, 1),
          8 + floor(random() * 5)::INT,
          CASE WHEN j = 1 AND random() < 0.3 THEN true ELSE false END,
          CASE WHEN j = num_sets AND random() < 0.15 THEN true ELSE false END,
          60 + floor(random() * 120)::INT,
          CASE WHEN random() < 0.7 THEN 'normal' ELSE 'high' END
        );
      END LOOP;
    END LOOP;

    workout_count := workout_count + 1;
  END LOOP;

  RAISE NOTICE 'Gym workouts generated: %', workout_count;
END $$;

-- ============================================================================
-- 12. COPY GARMIN DAILY DATA FROM TARAS
-- ============================================================================
INSERT INTO garmin_daily (date, steps, calories_total, calories_active, distance_m,
  floors_up, floors_down, intensity_minutes, resting_hr, avg_hr, max_hr,
  avg_stress, max_stress, body_battery_high, body_battery_low,
  sleep_seconds, sleep_score, spo2_avg, respiration_avg,
  hrv_weekly_avg, hrv_last_night, hrv_status,
  training_readiness_score, training_status, training_load, user_id)
SELECT date, steps, calories_total, calories_active, distance_m,
  floors_up, floors_down, intensity_minutes, resting_hr, avg_hr, max_hr,
  avg_stress, max_stress, body_battery_high, body_battery_low,
  sleep_seconds, sleep_score, spo2_avg, respiration_avg,
  hrv_weekly_avg, hrv_last_night, hrv_status,
  training_readiness_score, training_status, training_load, 748
FROM garmin_daily
WHERE user_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 13. COPY GARMIN SLEEP DATA FROM TARAS
-- ============================================================================
INSERT INTO garmin_sleep (date, sleep_start, sleep_end, duration_seconds,
  deep_seconds, light_seconds, rem_seconds, awake_seconds, sleep_score, user_id)
SELECT date, sleep_start, sleep_end, duration_seconds,
  deep_seconds, light_seconds, rem_seconds, awake_seconds, sleep_score, 748
FROM garmin_sleep
WHERE user_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 14. COPY GARMIN BODY COMPOSITION FROM TARAS
-- ============================================================================
INSERT INTO garmin_body_composition (date, weight, bmi, body_fat_pct, muscle_mass,
  bone_mass, body_water_pct, physique_rating, metabolic_age, visceral_fat, user_id)
SELECT date, weight, bmi, body_fat_pct, muscle_mass,
  bone_mass, body_water_pct, physique_rating, metabolic_age, visceral_fat, 748
FROM garmin_body_composition
WHERE user_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 15. COPY WITHINGS MEASUREMENTS FROM TARAS
-- ============================================================================
INSERT INTO withings_measurements (date, weight, fat_ratio, fat_mass,
  fat_free_mass, heart_rate, bmi, user_id)
SELECT date, weight, fat_ratio, fat_mass,
  fat_free_mass, heart_rate, bmi, 748
FROM withings_measurements
WHERE user_id = 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 16. SHOPPING ITEMS (active + some bought)
-- ============================================================================
INSERT INTO shopping_items (item_name, quantity, added_by, bought_at, bought_by, user_id)
VALUES
  ('Milk 1L',           '2',  'app', NULL, NULL, 748),
  ('Whole wheat bread',  '1',  'app', NULL, NULL, 748),
  ('Eggs (10 pack)',    '1',  'app', NULL, NULL, 748),
  ('Chicken breast',    '500g', 'app', NULL, NULL, 748),
  ('Bananas',           '6',  'app', NULL, NULL, 748),
  ('Olive oil',         '1',  'app', NULL, NULL, 748),
  ('Rice 1kg',          '1',  'app', NULL, NULL, 748),
  ('Greek yogurt',      '3',  'app', NULL, NULL, 748),
  ('Tomatoes',          '1kg', 'app', NULL, NULL, 748),
  ('Onions',            '1kg', 'app', NULL, NULL, 748),
  ('Pasta',             '2',  'app', NULL, NULL, 748),
  ('Cheddar cheese',    '200g','app', NULL, NULL, 748),
  ('Orange juice',      '1L', 'app', NULL, NULL, 748),
  ('Frozen veggies',    '1',  'app', NULL, NULL, 748),
  ('Coffee beans',      '500g','app', NULL, NULL, 748),
  ('Butter',            '1',  'app', NULL, NULL, 748),
  ('Garlic',            '3',  'app', NULL, NULL, 748),
  ('Dish soap',         '1',  'app', NOW(), 'Alex', 748),
  ('Paper towels',      '2',  'app', NOW(), 'Alex', 748),
  ('Laundry detergent', '1',  'app', NOW(), 'Alex', 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 17. CATEGORY FAVOURITES
-- ============================================================================
INSERT INTO category_favourites (category, user_id)
VALUES
  ('Groceries', 748),
  ('Restaurants', 748),
  ('Transport', 748),
  ('Salary', 748)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Done!
-- ============================================================================
DO $$
DECLARE
  tx_count INT;
  daily_count INT;
  workout_count INT;
BEGIN
  SELECT COUNT(*) INTO tx_count FROM transactions WHERE user_id = 748;
  SELECT COUNT(*) INTO daily_count FROM daily_log WHERE user_id = 748;
  SELECT COUNT(*) INTO workout_count FROM gym_workouts WHERE user_id = 748;
  RAISE NOTICE '=== DEMO DATA SEED COMPLETE ===';
  RAISE NOTICE 'Transactions: %', tx_count;
  RAISE NOTICE 'Daily log entries: %', daily_count;
  RAISE NOTICE 'Gym workouts: %', workout_count;
  RAISE NOTICE 'User ID: 748';
END $$;

-- ============================================================================
-- 18. SUBSCRIPTIONS
-- ============================================================================
DELETE FROM subscriptions WHERE user_id = 748;

INSERT INTO subscriptions (user_id, name, provider, amount, currency, billing_cycle, next_billing, category, is_active, url, notes, created_at)
VALUES
  -- Active subscriptions
  (748, 'Netflix',           'Netflix',    13.99, 'EUR', 'monthly', '2026-04-18', 'entertainment', true,  'https://netflix.com/account',         NULL,                                       '2022-11-03'),
  (748, 'Spotify Family',    'Spotify',    17.99, 'EUR', 'monthly', '2026-04-07', 'entertainment', true,  'https://spotify.com/account',         'Family plan — 6 members',                  '2021-06-14'),
  (748, 'Claude Pro',        'Anthropic',  20.00, 'USD', 'monthly', '2026-04-22', 'ai',            true,  'https://claude.ai/settings',          'Primary AI assistant for coding & writing','2023-10-01'),
  (748, 'iCloud+ 200GB',     'Apple',       2.99, 'EUR', 'monthly', '2026-04-11', 'storage',       true,  'https://appleid.apple.com',           'Phone backup + family sharing',            '2021-09-15'),
  (748, 'YouTube Premium',   'Google',     13.99, 'EUR', 'monthly', '2026-04-25', 'entertainment', true,  'https://youtube.com/premium',         'Background play + no ads',                 '2022-03-20'),
  (748, 'GitHub Pro',        'GitHub',      4.00, 'USD', 'monthly', '2026-04-14', 'development',   true,  'https://github.com/settings/billing', NULL,                                       '2021-04-01'),
  (748, 'Cloudflare Pro',    'Cloudflare', 20.00, 'USD', 'monthly', '2026-04-03', 'development',   true,  'https://dash.cloudflare.com',         'taras.cloud domain protection + analytics','2022-07-10'),
  (748, 'Google One 2TB',    'Google',      9.99, 'EUR', 'monthly', '2026-04-09', 'storage',       true,  'https://one.google.com',              'Shared with partner',                      '2023-01-28'),
  (748, 'ChatGPT Plus',      'OpenAI',     20.00, 'USD', 'monthly', '2026-04-17', 'ai',            true,  'https://chatgpt.com/settings',        'GPT-4o + image gen',                       '2023-05-15'),
  (748, 'Duolingo Super',    'Duolingo',    7.49, 'EUR', 'monthly', '2026-04-29', 'productivity',  true,  'https://duolingo.com/settings',       'Spanish streak — 847 days',                '2023-09-01'),
  (748, 'Docker Pro',        'Docker',      5.00, 'USD', 'monthly', '2026-04-21', 'development',   true,  'https://hub.docker.com/billing',      NULL,                                       '2022-05-18'),

  -- Inactive / cancelled subscriptions
  (748, 'Amazon Prime',      'Amazon',      4.99, 'EUR', 'monthly', NULL,          'entertainment', false, 'https://amazon.de/prime',            'Cancelled — barely used after moving to ES','2021-08-01'),
  (748, 'Xbox Game Pass',    'Microsoft',  14.99, 'EUR', 'monthly', NULL,          'entertainment', false, 'https://xbox.com/gamepass',          'Cancelled — no time to game',               '2022-02-10'),
  (748, 'HomeMoney',         'HomeMoney',  199.00,'UAH', 'yearly',  NULL,          'productivity',  false, 'https://homemoney.ua',               'Replaced by PD',                            '2021-03-01'),
  (748, 'Forus',             'Forus',       3.99, 'EUR', 'monthly', NULL,          'productivity',  false, 'https://forus.io',                   'Cancelled — limited features vs alternatives','2022-12-05');

-- ============================================================================
-- 19. BIG PURCHASES
-- ============================================================================
DELETE FROM big_purchases WHERE user_id = 748;

INSERT INTO big_purchases (user_id, name, description, estimated_price, currency, url, category, status, investigate_notes, cooling_started_at, cooling_days, confirmed_at, purchased_at, created_at, updated_at)
VALUES
  -- Investigating
  (748,
   'MacBook Pro M4',
   'Upgrade from M1 MacBook Pro 14" — considering M4 Pro 14" or M4 Max 16"',
   2799.00, 'EUR',
   'https://apple.com/macbook-pro',
   'electronics',
   'investigating',
   'M4 Pro 14" (€2799): 12-core CPU, 20-core GPU, 24GB RAM. M4 Max 16" (€3999): overkill for dev work. M4 base (€1799): only 16GB RAM — insufficient. Main use: Docker, Next.js, video calls. Current M1 14" still works fine but getting slow with 10+ Docker containers. Refurbished M4 Pro ~€2400 on Apple certified store. Black Friday potentially €200 off. Decision: wait for Q4 2026 sale or buy if M1 starts causing real issues.',
   NULL, 7, NULL, NULL,
   '2026-03-10', '2026-03-10'),

  (748,
   'Standing Desk',
   'Adjustable sit-stand desk for home office upgrade',
   599.00, 'EUR',
   'https://flexispot.com/standing-desks',
   'furniture',
   'investigating',
   'Flexispot E7 Pro (€499): solid reviews, 125kg load, dual-motor. Autonomous SmartDesk Pro (€549): better app but slower customer support in EU. Ikea Bekant sit/stand (€649): familiar brand, limited height range. Current fixed desk is 74cm — causes back pain after long sessions. Must have: dual-motor, min 60–125cm height, at least 140cm wide. Checking local deals on Kleinanzeigen.',
   NULL, 7, NULL, NULL,
   '2026-03-18', '2026-03-18'),

  -- Cooling off
  (748,
   'Sony WH-1000XM6',
   'Flagship noise-cancelling headphones — upgrade from XM4',
   379.00, 'EUR',
   'https://sony.com/headphones/wh-1000xm6',
   'electronics',
   'cooling_off',
   'XM6 vs XM5: improved ANC, multipoint 3 devices (was 2), USB-C fast charge 3h → 3min. XM4 still works but left ear cushion deteriorating. Amazon price €379, MediaMarkt €399. Cheaper refurb XM5 for €249 — but XM6 is current gen. Main use: focus work + travel 4-5x/year. Verdict: worth it for travel noise isolation.',
   NOW() - INTERVAL '5 days', 14, NULL, NULL,
   '2026-03-15', '2026-03-15'),

  (748,
   'Ergonomic Chair',
   'Replace aging IKEA Markus — lower back issues increasing',
   899.00, 'EUR',
   'https://hermanmiller.com/products/seating/office-chairs/aeron-chairs',
   'furniture',
   'cooling_off',
   'Herman Miller Aeron (€1699): gold standard, 12yr warranty — too expensive. Haworth Fern (€1499): great lumbar, no armrest height adjust. Secretlab Titan Evo (€529): gaming chair but surprisingly ergonomic. Ergohuman Pro (€899): mesh back, adjustable lumbar, 4D armrests — best value. Trying Ergohuman at local store — felt good after 30min sit test. €899 is significant but back pain costing productivity. Checking company expense reimbursement option.',
   NOW() - INTERVAL '20 days', 30, NULL, NULL,
   '2026-02-20', '2026-02-20'),

  -- Ready to buy
  (748,
   'Kindle Paperwhite',
   'E-reader for reading in bed without disturbing partner',
   149.00, 'EUR',
   'https://amazon.de/kindle-paperwhite',
   'electronics',
   'ready',
   'Paperwhite Signature (€149) vs basic Kindle (€99): warm light + wireless charging worth the extra €50 for bedside use. 16GB plenty. Colour Kindle considered but €279 is hard to justify for mostly fiction. Confirmed: Signature edition.',
   NULL, 7,
   NOW() - INTERVAL '3 days',
   NULL,
   '2026-03-18', '2026-03-18'),

  -- Purchased
  (748,
   'iPhone 15 Pro',
   'Upgrade from iPhone 12 Pro — titanium frame, USB-C, Action button',
   1299.00, 'EUR',
   'https://apple.com/iphone-15-pro',
   'electronics',
   'purchased',
   NULL, NULL, 7, NULL,
   NOW() - INTERVAL '6 months',
   '2025-08-20', '2025-08-20'),

  (748,
   'LG 27" 4K Monitor',
   'Secondary display for home office — LG 27UL850-W',
   449.00, 'EUR',
   'https://lg.com/monitors/27ul850',
   'electronics',
   'purchased',
   NULL, NULL, 7, NULL,
   NOW() - INTERVAL '8 months',
   '2025-07-01', '2025-07-01'),

  (748,
   'Dyson V15 Detect',
   'Cordless vacuum — laser dust detection, HEPA filter',
   699.00, 'EUR',
   'https://dyson.com/vacuum-cleaners/cordless/v15',
   'appliances',
   'purchased',
   NULL, NULL, 7, NULL,
   NOW() - INTERVAL '12 months',
   '2025-03-05', '2025-03-05'),

  (748,
   'Nike Pegasus 41',
   'Daily training running shoes — replacement for worn-out Pegasus 39',
   139.00, 'EUR',
   'https://nike.com/pegasus',
   'sports',
   'purchased',
   NULL, NULL, 7, NULL,
   NOW() - INTERVAL '3 months',
   '2026-01-10', '2026-01-10'),

  (748,
   'Samsonite Stackd 68cm',
   'Medium suitcase for 4–7 day trips — spinner wheels, TSA lock',
   259.00, 'EUR',
   'https://samsonite.com/stackd',
   'other',
   'purchased',
   NULL, NULL, 7, NULL,
   NOW() - INTERVAL '5 months',
   '2025-10-22', '2025-10-22'),

  -- Cancelled
  (748,
   'PS5 Pro',
   'Gaming console — upgrade consideration after PS5 Pro launch',
   799.00, 'EUR',
   'https://playstation.com/ps5-pro',
   'electronics',
   'cancelled',
   'PS5 Pro €799 vs regular PS5 €449: 45% GPU improvement, 2x ray tracing, 2TB SSD. Games I actually want: maybe 3-4 titles per year. Already have Steam library of 200+ games. Partner not into gaming. Time constraint: average 2h/week gaming. Decision: not worth €799 for occasional use. Will stick with PC gaming.',
   '2026-01-10', 14, NULL, NULL,
   '2026-01-01', '2026-01-01'),

  (748,
   'Dreame L20 Ultra Robot Vacuum',
   'Robot vacuum + mop combo — automate floor cleaning',
   499.00, 'EUR',
   'https://dreametech.com/l20-ultra',
   'appliances',
   'cancelled',
   'Dreame L20 Ultra (€499): solid specs, auto-empty, mop self-cleaning. Roborock S8 Pro (€549): better navigation reviews. Multiple 1-star reviews about mop soaking carpet edges — apartment is 60% carpet. Eufy X10 Pro (€399): no self-mop cleaning. Decided to wait for next gen or until moving to non-carpet apartment.',
   NULL, 7, NULL, NULL,
   '2025-11-15', '2025-11-15');

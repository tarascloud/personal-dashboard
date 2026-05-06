-- Daily demo data generator
-- Adds realistic data for demo user (ID 748) for today
-- Safe to run multiple times (ON CONFLICT DO NOTHING / checks for existing data)

DO $$
DECLARE
  today TEXT := to_char(NOW(), 'YYYY-MM-DD');
  today_date DATE := CURRENT_DATE;
  yr INT := EXTRACT(YEAR FROM today_date)::INT;
  mo INT := EXTRACT(MONTH FROM today_date)::INT;
  dow INT := EXTRACT(DOW FROM today_date)::INT; -- 0=Sun, 1=Mon...6=Sat
  demo_uid INT := 748;
  rand FLOAT;
  amt FLOAT;
  workout_id INT;
  ex_id INT;
  we_id INT;
  prev_level FLOAT;
  new_delta FLOAT;
  new_level FLOAT;
  stores TEXT[] := ARRAY['Albert Heijn', 'Lidl', 'Jumbo', 'Aldi', 'Plus'];
  restaurants TEXT[] := ARRAY['Cafe Central', 'Pizza Express', 'Sushi Bar', 'Thai Corner', 'Burger Joint'];
  transport TEXT[] := ARRAY['NS Train', 'OV-chipkaart', 'Uber', 'Bolt', 'Parking'];
BEGIN
  -- ====================================================================
  -- 1. DAILY LOG (mood, energy, sleep, stress)
  -- ====================================================================
  IF NOT EXISTS (SELECT 1 FROM daily_log WHERE user_id = demo_uid AND date = today_date) THEN
    -- Get previous level for random walk
    SELECT COALESCE(level, 0) INTO prev_level
    FROM daily_log WHERE user_id = demo_uid AND date < today_date
    ORDER BY date DESC LIMIT 1;

    new_delta := (random() - 0.45) * 4;  -- slight positive bias
    new_level := GREATEST(-3, LEAST(3, prev_level + new_delta * 0.15));

    INSERT INTO daily_log (date, user_id, level, mood_delta, energy_level, stress_level, focus_quality, alcohol, caffeine, kids_hours, sex_count, bj_count)
    VALUES (
      today_date, demo_uid,
      ROUND(new_level::NUMERIC, 2),
      ROUND(new_delta::NUMERIC, 1),
      1 + floor(random() * 5)::INT,                    -- energy 1-5
      1 + floor(random() * 5)::INT,                    -- stress 1-5
      2 + floor(random() * 4)::INT,                    -- focus 2-5
      CASE WHEN dow IN (5, 6) AND random() < 0.4 THEN 1 ELSE 0 END,  -- alcohol on weekends
      1 + floor(random() * 3)::INT,                    -- caffeine 1-3
      CASE WHEN dow = 0 THEN 3 + round((random() * 3)::numeric, 1)   -- Sun: 3-6h kids
           WHEN dow = 6 THEN 2 + round((random() * 4)::numeric, 1)   -- Sat: 2-6h
           ELSE 1 + round((random() * 3)::numeric, 1) END,           -- Weekdays: 1-4h
      CASE WHEN random() < 0.45 THEN 1 ELSE 0 END,    -- sex ~3x/week
      CASE WHEN random() < 0.30 THEN 1 ELSE 0 END     -- bj ~2x/week
    );
  END IF;

  -- ====================================================================
  -- 2. TRANSACTIONS (daily expenses)
  -- ====================================================================
  IF NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = demo_uid AND date = today_date AND source = 'demo_daily') THEN

    -- Groceries (80% chance, 1-2 per day)
    IF random() < 0.8 THEN
      amt := 8 + random() * 45;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Groceries', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), stores[1 + floor(random() * 5)::INT], 'demo_daily', demo_uid);
    END IF;

    -- Second grocery run (20% chance)
    IF random() < 0.2 THEN
      amt := 5 + random() * 20;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'Mono EUR', 'Groceries', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), stores[1 + floor(random() * 5)::INT], 'demo_daily', demo_uid);
    END IF;

    -- Restaurant/cafe (40% chance, more on weekends)
    IF random() < (CASE WHEN dow IN (5, 6, 0) THEN 0.6 ELSE 0.35 END) THEN
      amt := 10 + random() * 50;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Restaurants', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), restaurants[1 + floor(random() * 5)::INT], 'demo_daily', demo_uid);
    END IF;

    -- Transport (30% chance on weekdays)
    IF dow BETWEEN 1 AND 5 AND random() < 0.3 THEN
      amt := 3 + random() * 15;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Transport', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), transport[1 + floor(random() * 5)::INT], 'demo_daily', demo_uid);
    END IF;

    -- Entertainment (25% chance on evenings/weekends)
    IF random() < (CASE WHEN dow IN (5, 6) THEN 0.4 ELSE 0.15 END) THEN
      amt := 10 + random() * 40;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'Mono EUR', 'Entertainment', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), 'Entertainment', 'demo_daily', demo_uid);
    END IF;

    -- Subscriptions (1st of month)
    IF EXTRACT(DAY FROM today_date) = 1 THEN
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES
        (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Subscriptions', 14.99, 'EUR', 14.99, 'Netflix', 'demo_daily', demo_uid),
        (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Subscriptions', 9.99, 'EUR', 9.99, 'Spotify', 'demo_daily', demo_uid),
        (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Subscriptions', 6.99, 'EUR', 6.99, 'iCloud', 'demo_daily', demo_uid);
    END IF;

    -- Rent (1st of month)
    IF EXTRACT(DAY FROM today_date) = 1 THEN
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Rent', 1050, 'EUR', 1050, 'Monthly rent', 'demo_daily', demo_uid);
    END IF;

    -- Utilities (5th of month)
    IF EXTRACT(DAY FROM today_date) = 5 THEN
      amt := 80 + random() * 40;
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'EXPENSE', 'EXPENSE_PERSONAL', 'bunq', 'Utilities', ROUND(amt::NUMERIC, 2), 'EUR', ROUND(amt::NUMERIC, 2), 'Gas & Electric', 'demo_daily', demo_uid);
    END IF;

    -- Salary (25th of month)
    IF EXTRACT(DAY FROM today_date) = 25 THEN
      INSERT INTO transactions (date, year, month, type, sub_type, account, category, amount_original, currency_original, amount_eur, description, source, user_id)
      VALUES (today_date, yr, mo, 'INCOME', 'INCOME', 'bunq', 'Salary', 5100, 'EUR', 5100, 'Monthly salary - TechCorp', 'demo_daily', demo_uid);
    END IF;
  END IF;

  -- ====================================================================
  -- 3. GYM WORKOUTS (Mon/Wed/Fri = weights, Tue/Sat = cardio)
  -- ====================================================================
  IF NOT EXISTS (SELECT 1 FROM gym_workouts WHERE user_id = demo_uid AND date = today_date) THEN

    -- Mon/Wed/Fri: weight training (85% chance)
    IF dow IN (1, 3, 5) AND random() < 0.85 THEN
      INSERT INTO gym_workouts (date, duration_minutes, notes, user_id)
      VALUES (today_date, 50 + floor(random() * 30)::INT, 'Strength training', demo_uid)
      RETURNING id INTO workout_id;

      -- Add 4-5 exercises
      FOR i IN 1..4 + floor(random() * 2)::INT LOOP
        SELECT id INTO ex_id FROM gym_exercises
        WHERE user_id = demo_uid AND exercise_type IS DISTINCT FROM 'cardio'
        ORDER BY random() LIMIT 1;

        IF ex_id IS NOT NULL THEN
          INSERT INTO gym_workout_exercises (workout_id, exercise_id, order_num, user_id)
          VALUES (workout_id, ex_id, i, demo_uid)
          RETURNING id INTO we_id;

          -- 3-4 sets
          FOR j IN 1..3 + floor(random() * 2)::INT LOOP
            INSERT INTO gym_sets (workout_exercise_id, set_num, weight_kg, reps, user_id)
            VALUES (we_id, j, 20 + floor(random() * 60)::NUMERIC, 8 + floor(random() * 8)::INT, demo_uid);
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    -- Tue: cycling or running (70% chance)
    IF dow = 2 AND random() < 0.7 THEN
      SELECT id INTO ex_id FROM gym_exercises
      WHERE user_id = demo_uid AND name IN ('Road Cycling', 'Running')
      ORDER BY random() LIMIT 1;

      IF ex_id IS NOT NULL THEN
        INSERT INTO gym_workouts (date, duration_minutes, notes, user_id)
        VALUES (today_date, 30 + floor(random() * 50)::INT,
          CASE WHEN (SELECT name FROM gym_exercises WHERE id = ex_id) = 'Road Cycling'
            THEN 'Cycling ' || (15 + floor(random() * 25)::INT) || 'km'
            ELSE 'Running ' || (3 + floor(random() * 7)::INT) || 'km'
          END, demo_uid)
        RETURNING id INTO workout_id;

        INSERT INTO gym_workout_exercises (workout_id, exercise_id, order_num, user_id)
        VALUES (workout_id, ex_id, 1, demo_uid)
        RETURNING id INTO we_id;

        INSERT INTO gym_sets (workout_exercise_id, set_num, reps, weight_kg, user_id)
        VALUES (we_id, 1, 30 + floor(random() * 40)::INT, 10 + floor(random() * 20)::NUMERIC, demo_uid);
      END IF;
    END IF;

    -- Sat: long cardio (55% chance)
    IF dow = 6 AND random() < 0.55 THEN
      SELECT id INTO ex_id FROM gym_exercises
      WHERE user_id = demo_uid AND name IN ('Road Cycling', 'Running')
      ORDER BY random() LIMIT 1;

      IF ex_id IS NOT NULL THEN
        INSERT INTO gym_workouts (date, duration_minutes, notes, user_id)
        VALUES (today_date, 50 + floor(random() * 70)::INT,
          'Weekend ' || (SELECT CASE WHEN name = 'Road Cycling' THEN 'ride' ELSE 'run' END FROM gym_exercises WHERE id = ex_id),
          demo_uid)
        RETURNING id INTO workout_id;

        INSERT INTO gym_workout_exercises (workout_id, exercise_id, order_num, user_id)
        VALUES (workout_id, ex_id, 1, demo_uid)
        RETURNING id INTO we_id;

        INSERT INTO gym_sets (workout_exercise_id, set_num, reps, weight_kg, user_id)
        VALUES (we_id, 1, 50 + floor(random() * 60)::INT, 20 + floor(random() * 30)::NUMERIC, demo_uid);
      END IF;
    END IF;
  END IF;

  RAISE NOTICE 'Demo daily data generated for %', today;
END $$;

/**
 * Global teardown for Playwright test suite.
 *
 * Cleans up test-generated records that were not deleted during the test
 * run (e.g. a failed test that crashed between create and delete):
 *
 *   - gym_workouts: free workouts (workout_name IS NULL) finished by gym.spec
 *   - food_log: entries created by food.spec ("E2E Test Meal <ts>")
 *   - shopping_items / shopping_history: items created by shopping.spec
 *     ("Test item <ts>")
 *
 * Targets only records that look like test data (TEST markers and/or
 * created within the last 24 hours) — never touches demo seed data.
 *
 * Executes only against pd_dev — NEVER pd_prod.
 */

import { execSync } from "child_process";

interface CleanupStatement {
  label: string;
  sql: string;
}

const CLEANUP_STATEMENTS: CleanupStatement[] = [
  {
    label: "gym_workouts",
    sql: `
      DELETE FROM gym_workouts
      WHERE workout_name IS NULL
        AND end_time IS NOT NULL
        AND created_at > NOW() - INTERVAL '1 day';
    `,
  },
  {
    label: "food_log",
    sql: `
      DELETE FROM food_log
      WHERE description LIKE 'E2E Test Meal %'
        AND created_at > NOW() - INTERVAL '1 day';
    `,
  },
  {
    label: "shopping_items",
    sql: `
      DELETE FROM shopping_items
      WHERE item_name LIKE 'Test item %'
        AND added_at > NOW() - INTERVAL '1 day';
    `,
  },
  {
    label: "shopping_history",
    sql: `
      DELETE FROM shopping_history
      WHERE item_name LIKE 'Test item %'
        AND bought_date >= CURRENT_DATE - 1;
    `,
  },
];

function runCleanup(dbUrl: string, stmt: CleanupStatement): void {
  try {
    const result = execSync(
      `psql "${dbUrl}" -c "${stmt.sql.replace(/\n/g, " ").replace(/"/g, '\\"')}" -t`,
      { encoding: "utf8", timeout: 10000 },
    );
    const deleteLine = result
      .trim()
      .split("\n")
      .find((l) => l.trim().startsWith("DELETE"));
    if (deleteLine) {
      const count = parseInt(deleteLine.replace("DELETE", "").trim(), 10);
      if (count > 0) {
        console.log(
          `[global-teardown] Cleaned ${count} test record(s) from ${stmt.label}.`,
        );
      }
    } else {
      console.log(
        `[global-teardown] ${stmt.label}: psql output:`,
        result.trim(),
      );
    }
  } catch (err) {
    // Non-fatal: psql may not be available in all environments (CI without DB access).
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[global-teardown] ${stmt.label} cleanup skipped (psql unavailable or error): ${msg}`,
    );
  }
}

export default async function globalTeardown() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://pd:pd@localhost:5432/pd_dev";

  // Safety check: refuse to run teardown against prod DB
  if (dbUrl.includes("pd_prod")) {
    console.warn(
      "[global-teardown] Refusing to run teardown against prod DB. Skipping.",
    );
    return;
  }

  for (const stmt of CLEANUP_STATEMENTS) {
    runCleanup(dbUrl, stmt);
  }
}

/**
 * Global teardown for Playwright test suite.
 *
 * Cleans up test-generated gym workout records that were not deleted
 * during the test run (e.g. the deleteWorkoutById no-op in gym.spec.ts).
 *
 * Targets only records that look like test data:
 *   - created within the last 24 hours
 *   - workoutName IS NULL (free workouts started without a program)
 *   - endTime IS NOT NULL (completed workouts, meaning the test ran finish)
 *
 * Uses psql SSH tunnel to pd_dev DB (same connection used by dev env).
 * Executes only against pd_dev — NEVER pd_prod.
 */

import { execSync } from "child_process";

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

  const sql = `
    DELETE FROM "GymWorkout"
    WHERE "workoutName" IS NULL
      AND "endTime" IS NOT NULL
      AND "createdAt" > NOW() - INTERVAL '1 day';
  `;

  try {
    const result = execSync(
      `psql "${dbUrl}" -c "${sql.replace(/\n/g, " ").replace(/"/g, '\\"')}" -t`,
      { encoding: "utf8", timeout: 10000 },
    );
    const lines = result.trim().split("\n");
    // psql returns "DELETE N" on success
    const deleteLine = lines.find((l) => l.trim().startsWith("DELETE"));
    if (deleteLine) {
      const count = parseInt(deleteLine.replace("DELETE", "").trim(), 10);
      if (count > 0) {
        console.log(
          `[global-teardown] Cleaned ${count} test GymWorkout record(s) from pd_dev.`,
        );
      } else {
        console.log("[global-teardown] No test GymWorkout records to clean.");
      }
    } else {
      console.log("[global-teardown] Teardown ran, psql output:", result.trim());
    }
  } catch (err) {
    // Non-fatal: psql may not be available in all environments (CI without DB access).
    // Log and continue — test results are not affected.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[global-teardown] GymWorkout cleanup skipped (psql unavailable or error): ${msg}`,
    );
  }
}

import { test as base, expect, type Page } from "@playwright/test";

/**
 * React hydration errors are excluded from the strict jsErrors check
 * (occasional single mismatches are noise on dev), but they are NOT
 * silently swallowed: the auto `hydrationGuard` fixture counts them and
 * fails the test when a page produces a burst above the threshold —
 * a real hydration regression (class sh a1ab6f0: page renders empty)
 * floods the console with these errors.
 */
const IGNORED_ERRORS = [
  /Minified React error #418/, // hydration text mismatch
  /Minified React error #423/, // hydration node mismatch
  /Minified React error #425/, // hydration resuming error
  /hydration/i,
];

/** Max hydration errors tolerated per page before the test fails. */
export const HYDRATION_ERROR_LIMIT = 3;

function isIgnoredError(msg: string): boolean {
  return IGNORED_ERRORS.some((re) => re.test(msg));
}

/**
 * Extended test fixture that tracks JS errors (filtering hydration noise)
 * and provides helper methods for common assertions.
 */
export const test = base.extend<{
  /** Collected JS errors (excluding hydration) */
  jsErrors: string[];
  /** Auto-fixture: fails the test on a hydration error burst */
  hydrationGuard: void;
}>({
  jsErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isIgnoredError(err.message)) {
        errors.push(err.message);
      }
    });
    await use(errors);
  },
  hydrationGuard: [
    async ({ page }, use) => {
      const hydrationErrors: string[] = [];
      page.on("pageerror", (err) => {
        if (isIgnoredError(err.message)) {
          hydrationErrors.push(err.message);
        }
      });
      await use();
      expect(
        hydrationErrors.length,
        `Hydration error burst: ${hydrationErrors.length} hydration error(s) ` +
          `(limit ${HYDRATION_ERROR_LIMIT}) — likely a real hydration regression.\n` +
          hydrationErrors.slice(0, 5).join("\n"),
      ).toBeLessThanOrEqual(HYDRATION_ERROR_LIMIT);
    },
    { auto: true },
  ],
});

export { expect };

// ─── Helper functions ───

/** Navigate and wait for the page to be interactive */
export async function goTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}

/** Assert no unexpected JS errors were collected */
export function expectNoJSErrors(errors: string[]) {
  expect(errors, "Unexpected JS errors on page").toHaveLength(0);
}

/** Assert page has no Next.js/React error boundary */
export async function expectNoErrorBoundary(page: Page) {
  await expect(page.locator("body")).not.toContainText("Something went wrong");
}

/** Wait for cards to load (common pattern across pages) */
export async function waitForCards(page: Page, minCount = 1) {
  const cards = page.locator('[data-slot="card"]');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(minCount);
  return cards;
}

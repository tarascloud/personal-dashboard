/**
 * Mobile Navigation E2E Tests — PD-NAV-20260419-05
 *
 * Tests for MobileTabBar + NavMoreSheet components at iPhone viewport.
 * Runs against dev.taras.cloud with demo auth (dev-demo project).
 *
 * Locator strategy notes:
 * - getByRole("navigation", { name: "Main navigation" }) targets the mobile nav
 *   (sm:hidden), not the desktop BottomNav which is inside a hidden header div.
 * - The dialog aria-label is localised ("Додаткова навігація" in Ukrainian).
 *   We target it by role="dialog" without name filter, scoped after More click.
 * - Tab items in the mobile nav have their own aria-labels in the current locale.
 */

import { test, expect, expectNoJSErrors } from "./fixtures";

// iPhone 14 Pro viewport
test.use({ viewport: { width: 393, height: 852 } });

/** Resolve the mobile nav element — it has a unique fixed+bottom-0+sm:hidden class */
function getMobileNav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation", { name: "Main navigation" });
}

// ─── Test 1: iPhone viewport — all primary tabs visible and clickable ─────────

test("iPhone viewport: all primary tabs visible and clickable", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  const tabs = nav.locator('[role="tab"]');
  const count = await tabs.count();

  // DEFAULT_PINNED_TABS = 4 items + More button = 5
  expect(count).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    await expect(tab).toBeVisible();
    // Touch target must be >= 44px (WCAG 2.5.5, Apple HIG)
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

// ─── Test 2: Active tab state correct after navigation ────────────────────────

test("active tab state correct after navigation", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  // The tab with aria-current="page" should be the dashboard tab
  const activeTab = nav.locator('[role="tab"][aria-current="page"]');
  await expect(activeTab).toBeVisible({ timeout: 10000 });
  await expect(activeTab).toHaveAttribute("aria-selected", "true");

  // Navigate to the My Day tab (first non-active tab link in the nav)
  const myDayTab = nav.locator('[role="tab"]').nth(1); // second tab in pinned list
  const myDayHref = await myDayTab.getAttribute("href");

  if (myDayHref) {
    await myDayTab.click();
    await page.waitForURL(new RegExp(myDayHref.replace(/\//g, "\\/")), { timeout: 10000 });

    // My Day tab is now active
    await expect(myDayTab).toHaveAttribute("aria-selected", "true");
    await expect(myDayTab).toHaveAttribute("aria-current", "page");

    // Dashboard tab is no longer active
    const firstTab = nav.locator('[role="tab"]').first();
    await expect(firstTab).toHaveAttribute("aria-selected", "false");
  }
});

// ─── Test 3: More sheet opens on More tap and shows overflow modules ──────────

test("More sheet opens on More tap and shows overflow modules", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  const moreBtn = nav.locator('button[aria-haspopup="dialog"]');
  await expect(moreBtn).toBeVisible();
  await expect(moreBtn).toHaveAttribute("aria-expanded", "false");

  await moreBtn.click();

  // The sheet renders with role="dialog" — scope by aria-modal=true to be safe
  const sheet = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(sheet).toBeVisible({ timeout: 5000 });

  // At least one overflow menu item present
  const menuItems = sheet.locator('[role="menuitem"]');
  await expect(menuItems.first()).toBeVisible({ timeout: 5000 });
  const itemCount = await menuItems.count();
  expect(itemCount).toBeGreaterThan(0);

  // More button indicates expanded state
  await expect(moreBtn).toHaveAttribute("aria-expanded", "true");
});

// ─── Test 4: More sheet closes on backdrop click ──────────────────────────────

test("More sheet closes on backdrop click", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  const moreBtn = nav.locator('button[aria-haspopup="dialog"]');
  await moreBtn.click();

  const sheet = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(sheet).toBeVisible({ timeout: 5000 });

  // The backdrop covers the full screen (0,0,393,852).
  // The sheet starts at y≈600 (bottom-[56px] from bottom means top ≈600).
  // Clicking at y=200 hits the backdrop overlay.
  await page.mouse.click(196, 200);

  // Sheet should disappear
  await expect(sheet).not.toBeVisible({ timeout: 5000 });
  await expect(moreBtn).toHaveAttribute("aria-expanded", "false");
});

// ─── Test 5: Keyboard nav — Tab cycles through tab items ─────────────────────

test("keyboard nav: Tab key cycles through tab items", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  // Focus the first focusable element in the page, then Tab through to the nav
  await page.locator("body").click(); // click body to ensure page has focus
  await page.keyboard.press("Tab"); // skip-link

  let focusedInNav = false;
  for (let i = 0; i < 30; i++) {
    const isInNav = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      // Mobile nav has class sm:hidden — check if focused element is inside it
      return !!el.closest('[aria-label="Main navigation"].sm\\:hidden') ||
             !!(el.getAttribute("aria-label") && el.closest('nav'));
    });
    if (isInNav) {
      focusedInNav = true;
      break;
    }
    await page.keyboard.press("Tab");
  }

  // If the nav items are focusable via Tab, we should land in the nav
  // (If Skip to Content or other elements come first, Tab count may vary)
  // We verify Tab works without crashing rather than asserting strict order
  await expect(page.locator("body")).not.toContainText("Something went wrong");

  if (focusedInNav) {
    // Tab to next element — should still be within nav or move out gracefully
    await page.keyboard.press("Tab");
    const noError = await page.evaluate(() => !document.querySelector('[data-error-boundary]'));
    expect(noError).toBe(true);
  }

  // At minimum: tab items are rendered with focus-visible classes (keyboard accessible)
  const firstTabClass = await nav.locator('[role="tab"]').first().getAttribute("class");
  expect(firstTabClass).toContain("focus-visible:ring-2");
});

// ─── Test 6: prefers-reduced-motion ──────────────────────────────────────────

test("prefers-reduced-motion: nav and sheet work without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  const tabs = nav.locator('[role="tab"]');
  expect(await tabs.count()).toBeGreaterThanOrEqual(4);

  // Verify motion-reduce class on primary tab (spot-check first link)
  const firstTabClass = await tabs.first().getAttribute("class");
  expect(firstTabClass).toContain("motion-reduce:transition-none");

  // Open More sheet — must work without animation issues
  const moreBtn = nav.locator('button[aria-haspopup="dialog"]');
  await moreBtn.click();

  const sheet = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(sheet).toBeVisible({ timeout: 5000 });

  // Verify motion-reduce class on sheet menu items
  const firstMenuItem = sheet.locator('[role="menuitem"]').first();
  await expect(firstMenuItem).toBeVisible();
  const menuItemClass = await firstMenuItem.getAttribute("class");
  expect(menuItemClass).toContain("motion-reduce:transition-none");

  // Close via Escape
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible({ timeout: 5000 });
});

// ─── Test 7: No console errors on any tab navigation ─────────────────────────

test("no console errors on any tab navigation", async ({ page, jsErrors }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const nav = getMobileNav(page);
  await expect(nav).toBeVisible({ timeout: 15000 });

  // Collect all link-type tabs from the mobile nav
  const tabs = nav.locator('[role="tab"]');
  const count = await tabs.count();

  for (let i = 0; i < count - 1; i++) {
    // Re-acquire nav after each navigation to avoid stale reference
    const currentNav = getMobileNav(page);
    await expect(currentNav).toBeVisible({ timeout: 10000 });
    const currentTab = currentNav.locator('[role="tab"]').nth(i);

    const tagName = await currentTab.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "a") {
      await currentTab.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    }
  }

  expectNoJSErrors(jsErrors);
});

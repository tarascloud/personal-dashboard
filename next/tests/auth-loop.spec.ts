import { test, expect, request as pwRequest } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Auth-loop: every protected API route must reject unauthenticated requests.
 *
 * Each endpoint is hit WITHOUT a session (fresh APIRequestContext, no
 * storageState, no cookies) and must respond with 401/403/429 or a
 * redirect to /login — never a 2xx.
 *
 * A coverage guard test walks src/app/api/**\/route.ts and fails when a
 * route exists that is neither in PROTECTED_ENDPOINTS nor explicitly
 * declared public — so a newly added route without auth classification
 * turns the suite red.
 *
 * Runs in the no-auth projects (smoke / smoke-firefox / prod-smoke),
 * see playwright.config.ts.
 */

type Method = "GET" | "POST";

interface ProtectedEndpoint {
  method: Method;
  path: string;
  /** Allowed non-redirect statuses (default: 401, 403, 429). */
  allow?: number[];
}

// ---------------------------------------------------------------------------
// 27 protected endpoints (route.ts files × exported methods)
// ---------------------------------------------------------------------------
const PROTECTED_ENDPOINTS: ProtectedEndpoint[] = [
  { method: "GET", path: "/api/capital" },
  { method: "POST", path: "/api/chat" },
  { method: "POST", path: "/api/embeddings/backfill" },
  // Bearer-token webhook: 401 without token, 500 if token not configured.
  { method: "POST", path: "/api/garmin-mfa", allow: [401, 403, 429, 500] },
  // /api/health prefix is middleware-public, but the route guards itself.
  { method: "GET", path: "/api/health/screen-time" },
  { method: "POST", path: "/api/health/screen-time" },
  { method: "GET", path: "/api/insights" },
  { method: "POST", path: "/api/insights" },
  { method: "GET", path: "/api/monitoring" },
  { method: "POST", path: "/api/ollama/refresh" },
  { method: "GET", path: "/api/ollama/status" },
  { method: "POST", path: "/api/portfolio-snapshot" },
  { method: "GET", path: "/api/reporting/dps/balance" },
  { method: "GET", path: "/api/reporting/dps/declarations" },
  { method: "POST", path: "/api/reporting/dps/declarations" },
  { method: "GET", path: "/api/reporting/dps/payer-card" },
  { method: "POST", path: "/api/reporting/dps/test-connection" },
  { method: "POST", path: "/api/reporting/verify-kep" },
  { method: "GET", path: "/api/sync/garmin" },
  { method: "POST", path: "/api/sync/garmin" },
  { method: "POST", path: "/api/sync/health" },
  { method: "POST", path: "/api/sync/investments" },
  { method: "POST", path: "/api/sync/monobank" },
  // Catch-all proxy [...path] — exercised via a representative sub-path.
  { method: "GET", path: "/api/trading/status" },
  { method: "POST", path: "/api/trading/forceexit" },
  { method: "POST", path: "/api/upload/certificate" },
  { method: "POST", path: "/api/upload/tax-document" },
];

// Routes that intentionally serve unauthenticated traffic.
// (middleware publicPaths + webhook endpoints with their own token auth)
const PUBLIC_ROUTE_PREFIXES = [
  "/api/auth", // next-auth handlers
  "/api/health", // public healthcheck (sub-routes still guarded above)
  "/api/sync/withings", // Withings OAuth webhook + callback
];

const DEFAULT_ALLOWED_STATUSES = [401, 403, 429];

// ---------------------------------------------------------------------------
// Coverage guard: every route.ts must be classified
// ---------------------------------------------------------------------------
function listApiRoutePaths(): string[] {
  const apiRoot = path.join(__dirname, "..", "src", "app", "api");
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts" || entry.name === "route.tsx") {
        const rel = path.relative(apiRoot, dir).split(path.sep);
        // Strip dynamic segments: [...path] / [id] → route prefix
        const urlSegments = rel.filter((s) => !s.startsWith("["));
        found.push("/api/" + urlSegments.join("/"));
      }
    }
  };

  walk(apiRoot);
  return found.sort();
}

test.describe("API auth-loop — route coverage", () => {
  test("every API route is classified as protected or public", () => {
    const routePaths = listApiRoutePaths();
    expect(routePaths.length).toBeGreaterThan(0);

    const unclassified = routePaths.filter((routePath) => {
      const isPublic = PUBLIC_ROUTE_PREFIXES.some(
        (p) => routePath === p || routePath.startsWith(p + "/"),
      );
      const isProtected = PROTECTED_ENDPOINTS.some(
        (e) => e.path === routePath || e.path.startsWith(routePath + "/"),
      );
      return !isPublic && !isProtected;
    });

    expect(
      unclassified,
      `New API route(s) without auth-loop classification: ${unclassified.join(", ")}. ` +
        "Add them to PROTECTED_ENDPOINTS (with an auth check in the route!) " +
        "or to PUBLIC_ROUTE_PREFIXES in tests/auth-loop.spec.ts.",
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Auth-loop: unauthenticated request → 401/403 or redirect to /login
// ---------------------------------------------------------------------------
test.describe("API auth-loop — no session", () => {
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`${ep.method} ${ep.path} rejects unauthenticated request`, async ({
      baseURL,
    }) => {
      // Fresh context: no cookies / storageState even in demo projects.
      const ctx = await pwRequest.newContext({ baseURL });
      try {
        const res = await ctx.fetch(ep.path, {
          method: ep.method,
          maxRedirects: 0,
          failOnStatusCode: false,
          headers: { "Content-Type": "application/json" },
          data: ep.method === "POST" ? "{}" : undefined,
        });
        const status = res.status();

        if (status >= 300 && status < 400) {
          const location = res.headers()["location"] ?? "";
          expect(
            location,
            `${ep.method} ${ep.path}: unauthenticated redirect must go to /login, got "${location}"`,
          ).toContain("/login");
        } else {
          const allowed = ep.allow ?? DEFAULT_ALLOWED_STATUSES;
          expect(
            allowed,
            `${ep.method} ${ep.path} must not be served without a session (got HTTP ${status})`,
          ).toContain(status);
        }
      } finally {
        await ctx.dispose();
      }
    });
  }
});

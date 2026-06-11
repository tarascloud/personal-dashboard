import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyDemoToken, DEMO_COOKIE } from "@/lib/demo-token";

// Routes that authenticate via bearer tokens / signed webhooks,
// not cookie sessions — exempt from CSRF Origin check.
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth",        // next-auth (has its own CSRF token)
  "/api/health",
  "/api/sync/withings",
  "/api/sync/monobank/webhook",
  "/api/garmin-mfa",
];

function csrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Defence-in-depth CSRF check for state-changing API routes that rely on
 * cookie sessions. SameSite=Lax already blocks cross-site POSTs from
 * browsers, but we additionally verify that the Origin header matches
 * the request Host so a compromised subdomain or a misconfigured
 * SameSite=None cookie cannot be abused.
 */
function csrfBlocked(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (!req.nextUrl.pathname.startsWith("/api/")) return false;
  if (csrfExempt(req.nextUrl.pathname)) return false;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    // Non-browser clients (server-to-server) must use bearer auth on
    // an exempt route; cookie-session API calls without Origin are
    // rejected.
    return true;
  }
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) return true;
  } catch {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF Origin check (runs before any auth logic so unauthenticated
  // cross-site POSTs are rejected consistently).
  if (csrfBlocked(req)) {
    return NextResponse.json(
      { error: "CSRF: Origin header missing or does not match Host" },
      { status: 403 },
    );
  }

  // Public routes (no auth required)
  // /opengraph-image — Next.js App Router convention (src/app/opengraph-image.tsx),
  // must be public so social crawlers get the PNG instead of a /login redirect.
  // twitter:image reuses the same route; manifest/icons are static files in
  // public/ and already pass via the matcher exclusion + extension check below.
  const publicPaths = ["/login", "/about", "/api/auth", "/api/health", "/api/sync/withings", "/api/sync/monobank/webhook", "/api/garmin-mfa", "/sitemap.xml", "/robots.txt", "/opengraph-image"];

  // Landing page is public (authenticated users get redirected in page.tsx)
  if (pathname === "/") return NextResponse.next();
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  // Allow static assets from public/
  if (/\.(png|jpg|jpeg|svg|ico|webp|gif|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // Demo mode: allow access only if the signed demo token is valid
  const demoToken = req.cookies.get(DEMO_COOKIE)?.value;
  if (demoToken && (await verifyDemoToken(demoToken))) {
    return NextResponse.next();
  }

  // Verify JWT session token (checks signature + expiry, not just cookie existence)
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://"),
  });

  if (!token?.email) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|serwist).*)"],
};

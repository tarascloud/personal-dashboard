"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createDemoToken,
  verifyDemoToken,
  DEMO_COOKIE,
  DEMO_TTL_SECONDS,
} from "@/lib/demo-token";

const DEMO_EMAIL = "demo@example.com";

async function refreshDemoDataIfNeeded() {
  try {
    const result = await prisma.$queryRaw<{ max_date: Date | null }[]>`
      SELECT MAX(date) as max_date FROM daily_log
      WHERE user_id = (SELECT id FROM users WHERE email = ${DEMO_EMAIL})
    `;
    const lastDate = result[0]?.max_date;
    if (!lastDate) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(lastDate);
    last.setHours(0, 0, 0, 0);

    if (last >= today) return;

    const fs = await import("fs");
    const path = await import("path");
    const crypto = await import("crypto");

    // Resolve to absolute path and verify it is within the expected scripts directory.
    // This prevents path traversal if process.cwd() or the constant is ever manipulated.
    const expectedDir = path.resolve(process.cwd(), "scripts");
    const sqlPath = path.resolve(expectedDir, "daily-demo-data.sql");

    // Guard: ensure the resolved path stays inside the scripts directory
    if (!sqlPath.startsWith(expectedDir + path.sep) && sqlPath !== expectedDir) {
      console.error("[demo] SQL path resolved outside scripts directory — aborting");
      return;
    }

    if (!fs.existsSync(sqlPath)) return;

    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Compute SHA-256 of the file and compare against an expected digest.
    // The digest must be updated whenever daily-demo-data.sql is intentionally changed.
    // Generate with: openssl dgst -sha256 scripts/daily-demo-data.sql
    const EXPECTED_DIGEST = process.env.DEMO_SQL_SHA256;
    if (!EXPECTED_DIGEST) {
      // ARC-20260507-0008: explicit failure instead of silent skip so that
      // operators notice when demo data stops refreshing. Health endpoint
      // exposes `demoChecksumConfigured: false` and the thrown error reaches
      // application logs / Sentry. Caller (refreshDemoDataIfNeeded) catches
      // and logs but the error is observable rather than absorbed silently.
      console.error("[demo] DEMO_SQL_SHA256 env var is not set — demo data refresh DISABLED. Set DEMO_SQL_SHA256 in env to re-enable.");
      throw new Error("DEMO_SQL_SHA256 env var is not configured — demo refresh disabled");
    }

    const actual = crypto.createHash("sha256").update(sql, "utf-8").digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(EXPECTED_DIGEST, "hex"))) {
      console.error("[demo] daily-demo-data.sql checksum mismatch — refusing to execute");
      return;
    }

    console.info("[demo] Refreshing demo data via daily-demo-data.sql");
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    // Demo refresh is not critical to login flow, but log it so failures
    // are visible in monitoring (`pg:status.errors`) and not absorbed silently.
    console.warn(
      "[demo] refreshDemoDataIfNeeded skipped:",
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function enterDemoMode() {
  // Ensure demo user exists
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: "Demo User",
        role: "user",
      },
    });
  }

  // Refresh demo data if stale
  await refreshDemoDataIfNeeded();

  const token = await createDemoToken();

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: DEMO_TTL_SECONDS,
  });

  redirect("/dashboard");
}

export async function exitDemoMode() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);
  redirect("/login");
}

export async function isDemoMode(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEMO_COOKIE)?.value;
  return verifyDemoToken(token);
}

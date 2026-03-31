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
    if (EXPECTED_DIGEST) {
      const actual = crypto.createHash("sha256").update(sql, "utf-8").digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(EXPECTED_DIGEST, "hex"))) {
        console.error("[demo] daily-demo-data.sql checksum mismatch — refusing to execute");
        return;
      }
    } else {
      // No checksum configured — log a warning so operators know to set DEMO_SQL_SHA256
      console.warn("[demo] DEMO_SQL_SHA256 not set; skipping checksum verification of demo SQL");
    }

    console.info("[demo] Refreshing demo data via daily-demo-data.sql");
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // non-critical, don't block demo login
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

  redirect("/finance");
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

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSecretValue } from "@/actions/settings";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const categoriesSchema = z.object({
  social: z.number().min(0).optional(),
  productivity: z.number().min(0).optional(),
  entertainment: z.number().min(0).optional(),
  reading: z.number().min(0).optional(),
  other: z.number().min(0).optional(),
});

const topAppSchema = z.object({
  name: z.string().min(1),
  bundleId: z.string().optional(),
  minutes: z.number().min(0),
  category: z.string().optional(),
});

const screenTimeBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD"),
  totalMinutes: z.number().int().min(0),
  categories: categoriesSchema.optional(),
  topApps: z.array(topAppSchema).optional().default([]),
  pickups: z.number().int().min(0).optional(),
  notifications: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the authenticated userId from either:
 *  1. NextAuth session (web dashboard)
 *  2. Bearer token (iOS Shortcut / external)
 *
 * Returns userId (number) or a NextResponse (error).
 */
async function resolveUserId(
  request: Request,
): Promise<number | NextResponse> {
  // 1. Try session auth first
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (user) return user.id;
  }

  // 2. Try Bearer token (token stored encrypted in secrets table per user)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Find all users who have a screen_time_api_token
    const secrets = await prisma.secret.findMany({
      where: { key: "screen_time_api_token" },
      select: { userId: true },
    });

    for (const secret of secrets) {
      const decrypted = await getSecretValue(secret.userId, "screen_time_api_token");
      if (!decrypted) continue;

      const expectedBuf = Buffer.from(decrypted, "utf-8");
      const tokenBuf = Buffer.from(token, "utf-8");

      if (
        tokenBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(tokenBuf, expectedBuf)
      ) {
        return secret.userId;
      }
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ---------------------------------------------------------------------------
// POST /api/health/screen-time — create or update screen time entry
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth check FIRST
  const userIdOrError = await resolveUserId(request);
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  // Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = screenTimeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { date, totalMinutes, categories, topApps, pickups, notifications } =
    parsed.data;

  const dateObj = new Date(date + "T00:00:00.000Z");

  // Check if record already exists
  const existing = await prisma.screenTime.findUnique({
    where: { userId_date: { userId, date: dateObj } },
    select: { id: true },
  });

  const record = await prisma.screenTime.upsert({
    where: { userId_date: { userId, date: dateObj } },
    update: {
      totalMinutes,
      categories: categories ?? undefined,
      topApps: topApps.length > 0 ? topApps : undefined,
      pickups,
      notifications,
    },
    create: {
      userId,
      date: dateObj,
      totalMinutes,
      categories: categories ?? undefined,
      topApps: topApps.length > 0 ? topApps : undefined,
      pickups,
      notifications,
    },
  });

  return NextResponse.json(
    { ok: true, id: record.id, created: !existing },
    { status: existing ? 200 : 201 },
  );
}

// ---------------------------------------------------------------------------
// GET /api/health/screen-time — return last 30 days for authenticated user
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Auth check FIRST
  const userIdOrError = await resolveUserId(request);
  if (userIdOrError instanceof NextResponse) return userIdOrError;
  const userId = userIdOrError;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const records = await prisma.screenTime.findMany({
    where: {
      userId,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      totalMinutes: true,
      categories: true,
      topApps: true,
      pickups: true,
      notifications: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, count: records.length, data: records });
}

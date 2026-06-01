export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";
import { timingSafeCompareStr } from "@/lib/timing-safe";

/**
 * Public API endpoint for receiving Garmin MFA codes.
 * Called by Cloudflare Email Worker or external automation.
 * Auth: Bearer token from GARMIN_MFA_API_TOKEN env var.
 *
 * POST /api/garmin-mfa
 * Body: { "code": "123456" } or { "emailBody": "...raw email text..." }
 */
export async function POST(request: Request) {
  try {
    const apiToken = process.env.GARMIN_MFA_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json({ error: "GARMIN_MFA_API_TOKEN not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${apiToken}`;
    if (!timingSafeCompareStr(authHeader, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // IP-based rate limiting for this public endpoint
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("cf-connecting-ip")
      || "unknown";
    try {
      await checkRateLimit(`ip:${ip}`, "/api/garmin-mfa");
    } catch (e) {
      if (e instanceof RateLimitError) return rateLimitResponse(e);
      console.warn("[rate-limit] Unexpected error in /api/garmin-mfa, allowing request:", e);
    }

    const body = await request.json();
    let mfaCode: string | null = null;

    if (body.code) {
      // Direct code submission
      mfaCode = String(body.code).trim();
    } else if (body.emailBody) {
      // Parse MFA code from email body text
      mfaCode = extractMfaCode(body.emailBody);
    }

    if (!mfaCode || !/^\d{6}$/.test(mfaCode)) {
      return NextResponse.json({ error: "Invalid or missing MFA code" }, { status: 400 });
    }

    // Require an explicit userId in the request body. No env-var fallback.
    // Previously, a caller with the API token could submit an MFA code
    // without knowing which user it belonged to, and the handler would
    // pick "any user with status=required". That made it possible to
    // hijack another user's Garmin login with a stolen/brute-forced
    // code, or to deliver the wrong code to the wrong user.
    //
    // DEV-20260512-0008: removed GARMIN_MFA_DEFAULT_USER_ID env-var fallback.
    // It was meant for single-user deployments, but it silently couples MFA
    // to one account regardless of which user the email actually belongs to —
    // unsafe as soon as a second user is invited. Callers (Email Worker)
    // must now resolve the user explicitly and include body.userId.
    if (typeof body.userId !== "number" || !Number.isInteger(body.userId)) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid userId. Provide body.userId (integer) — env-var fallback removed.",
        },
        { status: 400 }
      );
    }
    const requestedUserId: number = body.userId;

    const verified = await prisma.userPreference.findFirst({
      where: {
        userId: requestedUserId,
        key: "garmin_mfa_status",
        value: "required",
      },
      select: { userId: true },
    });
    if (!verified) {
      return NextResponse.json(
        { error: "User is not waiting for MFA" },
        { status: 403 }
      );
    }
    const targetUserId: number = verified.userId;

    // Store MFA code for the matched user — scheduler picks it up
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: targetUserId, key: "garmin_mfa_code" } },
      update: { value: mfaCode },
      create: { userId: targetUserId, key: "garmin_mfa_code", value: mfaCode },
    });

    // Reset MFA status so scheduler retries
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: targetUserId, key: "garmin_mfa_status" } },
      update: { value: "code_received" },
      create: { userId: targetUserId, key: "garmin_mfa_status", value: "code_received" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Garmin MFA API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

/** Extract 6-digit MFA code from Garmin email body */
function extractMfaCode(text: string): string | null {
  // Garmin MFA emails contain a 6-digit verification code
  // Common patterns: "verification code is 123456", "code: 123456", standalone 6-digit number
  const patterns = [
    /verification\s+code\s*(?:is|:)\s*(\d{6})/i,
    /code\s*(?:is|:)\s*(\d{6})/i,
    /\b(\d{6})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

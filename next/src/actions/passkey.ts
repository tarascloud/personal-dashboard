"use server";

import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { redis } from "@/lib/redis";

const RP_NAME = "Personal Dashboard";

function getRpId(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3333";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

function getOrigin(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3333";
}

// Store challenges in cookies (stateless, no Redis needed)
async function setChallenge(challenge: string) {
  const jar = await cookies();
  jar.set("webauthn_challenge", challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300, // 5 minutes
    path: "/",
  });
}

async function getChallenge(): Promise<string | null> {
  const jar = await cookies();
  const val = jar.get("webauthn_challenge")?.value ?? null;
  if (val) jar.delete("webauthn_challenge");
  return val;
}

/* ── Registration (logged-in user adds a passkey) ── */

export async function getPasskeyRegistrationOptions() {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { passkeys: true },
  });
  if (!user) return { error: "User not found" };

  const existingCredentials = user.passkeys.map((pk) => ({
    id: pk.credentialId,
    transports: (pk.transports?.split(",") ?? []) as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpId(),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await setChallenge(options.challenge);

  return { options };
}

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  friendlyName?: string,
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const expectedChallenge = await getChallenge();
  if (!expectedChallenge) return { error: "Challenge expired" };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { error: "User not found" };

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { error: "Verification failed" };
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports?.join(",") ?? null,
        friendlyName: friendlyName || `Passkey ${new Date().toLocaleDateString()}`,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error("[passkey] Registration error:", e);
    return { error: "Registration failed" };
  }
}

// ── Passkey sign-in nonce (replay protection) ─────────────────────────────
// After WebAuthn challenge verification succeeds we need to call NextAuth's
// signIn("credentials") with a token that the authorize() callback can verify.
// A static prefix ("__magic_link__passkey_<id>") would be replayable if the
// credentials provider were ever called directly.  Instead we generate a
// single-use, short-lived nonce, store it in Redis, and consume it in auth.ts.

const PASSKEY_NONCE_TTL_SECONDS = 30; // generous but short window
const PASSKEY_NONCE_PREFIX = "passkey_nonce:";

/**
 * Create a one-time nonce tied to `passkeyId` and store it in Redis.
 * Falls back to in-memory Map when Redis is unavailable (dev/test only).
 */
const inMemoryNonceStore = new Map<string, { passkeyId: string; expiresAt: number }>();

async function createPasskeyNonce(passkeyId: string): Promise<string> {
  const nonce = randomBytes(32).toString("hex");
  const key = PASSKEY_NONCE_PREFIX + nonce;

  if (redis) {
    await redis.set(key, passkeyId, "EX", PASSKEY_NONCE_TTL_SECONDS);
  } else {
    // In-memory fallback (single-process dev only — not suitable for production clusters)
    inMemoryNonceStore.set(nonce, {
      passkeyId,
      expiresAt: Date.now() + PASSKEY_NONCE_TTL_SECONDS * 1000,
    });
  }

  return nonce;
}

/**
 * Verify and consume a passkey nonce.
 * Returns the associated passkeyId on success, null if invalid/expired.
 */
export async function consumePasskeyNonce(nonce: string): Promise<string | null> {
  const key = PASSKEY_NONCE_PREFIX + nonce;

  if (redis) {
    // Atomic get-and-delete: consume is a one-time operation
    const [passkeyId] = await redis.pipeline().get(key).del(key).exec() as [[null, string | null], [null, number]];
    return passkeyId[1] ?? null;
  } else {
    const entry = inMemoryNonceStore.get(nonce);
    if (!entry) return null;
    inMemoryNonceStore.delete(nonce);
    if (entry.expiresAt < Date.now()) return null;
    return entry.passkeyId;
  }
}

/* ── Authentication (login with passkey) ── */

export async function getPasskeyAuthenticationOptions(): Promise<{ options?: PublicKeyCredentialRequestOptionsJSON; error?: string }> {
  try {
    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      userVerification: "preferred",
    });

    await setChallenge(options.challenge);

    return { options };
  } catch (e) {
    console.error("[passkey] Auth options error:", e);
    return { error: "Failed to generate authentication options" };
  }
}

export async function verifyPasskeyAuthentication(response: AuthenticationResponseJSON) {
  const expectedChallenge = await getChallenge();
  if (!expectedChallenge) return { error: "Challenge expired" };

  // Find the passkey by credential ID
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });

  if (!passkey) return { error: "Passkey not found" };

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
        transports: (passkey.transports?.split(",") ?? []) as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      return { error: "Verification failed" };
    }

    // Update counter and last used
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Sign in via NextAuth credentials using a single-use nonce.
    // The nonce is stored in Redis and consumed by auth.ts authorize(),
    // preventing replay attacks against the credentials provider.
    const nonce = await createPasskeyNonce(passkey.id);
    try {
      await signIn("credentials", {
        email: passkey.user.email,
        password: `__magic_link__passkey_nonce_${nonce}`,
        redirect: false,
      });
    } catch (e: unknown) {
      // NextAuth throws NEXT_REDIRECT on success
      if (e && typeof e === "object" && "digest" in e) {
        const digest = (e as { digest: string }).digest;
        if (typeof digest === "string" && digest.includes("NEXT_REDIRECT")) {
          return { ok: true, email: passkey.user.email };
        }
      }
      throw e;
    }

    return { ok: true, email: passkey.user.email };
  } catch (e) {
    console.error("[passkey] Authentication error:", e);
    return { error: "Authentication failed" };
  }
}

/* ── Management (list/delete passkeys) ── */

export async function getUserPasskeys() {
  const session = await auth();
  if (!session?.user?.email) return [];

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return [];

  const passkeys = await prisma.passkey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      friendlyName: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return passkeys;
}

export async function deletePasskey(passkeyId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { error: "User not found" };

  await prisma.passkey.deleteMany({
    where: { id: passkeyId, userId: user.id },
  });

  return { ok: true };
}

export async function renamePasskey(passkeyId: string, name: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { error: "User not found" };

  await prisma.passkey.updateMany({
    where: { id: passkeyId, userId: user.id },
    data: { friendlyName: name },
  });

  return { ok: true };
}

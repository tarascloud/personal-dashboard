import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock auth
vi.mock("./auth", () => ({
  auth: vi.fn(),
}));

// Mock demo-token
vi.mock("./demo-token", () => ({
  verifyDemoToken: vi.fn(),
  DEMO_COOKIE: "demo_mode",
}));

// Mock prisma
vi.mock("./db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { cookies } from "next/headers";
import { auth } from "./auth";
import { verifyDemoToken } from "./demo-token";
import { prisma } from "./db";
import { getCurrentUser, requireOwner, invalidateUserCache } from "./current-user";

const mockCookies = vi.mocked(cookies);
const mockAuth = vi.mocked(auth);
const mockVerifyDemoToken = vi.mocked(verifyDemoToken);
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);

const demoUser = { id: 1, email: "demo@example.com", name: "Demo User", role: "user" } as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
const ownerUser = { id: 2, email: "owner@example.com", name: "Owner", role: "owner" } as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
const regularUser = { id: 3, email: "user@example.com", name: "Regular", role: "user" } as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

function makeCookieStore(value: string | undefined) {
  return {
    get: (name: string) => (name === "demo_mode" ? (value ? { value } : undefined) : undefined),
  } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear user cache between tests by invalidating known emails
  invalidateUserCache("demo@example.com");
  invalidateUserCache("owner@example.com");
  invalidateUserCache("user@example.com");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser — demo mode", () => {
  it("returns demo user when demo token is valid", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("valid-token") as any);
    mockVerifyDemoToken.mockResolvedValue(true);
    mockFindUnique.mockResolvedValue(demoUser);

    const user = await getCurrentUser();
    expect(user?.email).toBe("demo@example.com");
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("creates demo user if not found in DB", async () => {
    invalidateUserCache("demo@example.com");
    mockCookies.mockResolvedValue(makeCookieStore("valid-token") as any);
    mockVerifyDemoToken.mockResolvedValue(true);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(demoUser);

    const user = await getCurrentUser();
    expect(user?.email).toBe("demo@example.com");
    expect(mockCreate).toHaveBeenCalledWith({
      data: { email: "demo@example.com", name: "Demo User", role: "user" },
    });
  });
});

describe("getCurrentUser — cache TTL", () => {
  it("returns cached result on second call within 5s", async () => {
    invalidateUserCache("user@example.com");
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: { email: "user@example.com" } } as any);
    mockFindUnique.mockResolvedValue(regularUser);

    await getCurrentUser(); // first call — DB hit
    await getCurrentUser(); // second call — should hit cache

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache is invalidated", async () => {
    invalidateUserCache("user@example.com");
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: { email: "user@example.com" } } as any);
    mockFindUnique.mockResolvedValue(regularUser);

    await getCurrentUser();
    invalidateUserCache("user@example.com");
    await getCurrentUser();

    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });
});

describe("getCurrentUser — no session", () => {
  it("returns null when session is missing", async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue(null as any);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns null when session has no email", async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: {} } as any);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

describe("requireOwner", () => {
  it("throws Forbidden for non-owner user", async () => {
    invalidateUserCache("user@example.com");
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: { email: "user@example.com" } } as any);
    mockFindUnique.mockResolvedValue(regularUser);

    await expect(requireOwner()).rejects.toThrow("Forbidden");
  });

  it("returns user for owner role", async () => {
    invalidateUserCache("owner@example.com");
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ user: { email: "owner@example.com" } } as any);
    mockFindUnique.mockResolvedValue(ownerUser);

    const user = await requireOwner();
    expect(user.role).toBe("owner");
  });

  it("throws Unauthorized when not logged in", async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined) as any);
    mockVerifyDemoToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue(null as any);

    await expect(requireOwner()).rejects.toThrow("Unauthorized");
  });
});

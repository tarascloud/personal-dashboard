import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/current-user", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { requireOwner } from "@/lib/current-user";
import { GET } from "./route";

const mockRequireOwner = vi.mocked(requireOwner);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/monitoring — auth gate", () => {
  it("returns 401 when requireOwner throws Unauthorized", async () => {
    mockRequireOwner.mockRejectedValue(new Error("Unauthorized"));

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when requireOwner throws Forbidden (non-owner user)", async () => {
    mockRequireOwner.mockRejectedValue(new Error("Forbidden"));

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });
});

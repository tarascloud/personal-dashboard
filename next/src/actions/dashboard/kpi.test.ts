import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/current-user", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { previousPeriodRange } from "./utils";

describe("previousPeriodRange", () => {
  describe("preset-based comparison", () => {
    it("today → yesterday", () => {
      const result = previousPeriodRange("2024-03-15", "2024-03-15", "today");
      expect(result.from).toBe("2024-03-14");
      expect(result.to).toBe("2024-03-14");
    });

    it("this_week → shifted 7 days back", () => {
      // Mon Mar 11 – Fri Mar 15 → Mon Mar 4 – Fri Mar 8
      const result = previousPeriodRange("2024-03-11", "2024-03-15", "this_week");
      expect(result.from).toBe("2024-03-04");
      expect(result.to).toBe("2024-03-08");
    });

    it("prev_week → shifted 7 days back", () => {
      const result = previousPeriodRange("2024-03-04", "2024-03-10", "prev_week");
      expect(result.from).toBe("2024-02-26");
      expect(result.to).toBe("2024-03-03");
    });

    it("this_month → shifted 30 days back", () => {
      // Jun 1 – Jun 3 → May 2 – May 4
      const result = previousPeriodRange("2024-06-01", "2024-06-03", "this_month");
      expect(result.from).toBe("2024-05-02");
      expect(result.to).toBe("2024-05-04");
    });

    it("prev_month → shifted 30 days back", () => {
      // Mar 1 – Mar 31 → Jan 31 – Mar 1
      const result = previousPeriodRange("2024-03-01", "2024-03-31", "prev_month");
      expect(result.from).toBe("2024-01-31");
      expect(result.to).toBe("2024-03-01");
    });

    it("this_year → same period last year", () => {
      const result = previousPeriodRange("2024-01-01", "2024-04-03", "this_year");
      expect(result.from).toBe("2023-01-01");
      expect(result.to).toBe("2023-04-03");
    });

    it("prev_year → year before", () => {
      const result = previousPeriodRange("2023-01-01", "2023-12-31", "prev_year");
      expect(result.from).toBe("2022-01-01");
      expect(result.to).toBe("2022-12-31");
    });

    it("today handles year boundary", () => {
      const result = previousPeriodRange("2024-01-01", "2024-01-01", "today");
      expect(result.from).toBe("2023-12-31");
      expect(result.to).toBe("2023-12-31");
    });

    it("this_week handles year boundary", () => {
      // Jan 1 (Mon) – Jan 5 → Dec 25 – Dec 29
      const result = previousPeriodRange("2024-01-01", "2024-01-05", "this_week");
      expect(result.from).toBe("2023-12-25");
      expect(result.to).toBe("2023-12-29");
    });
  });

  describe("fallback: equal-length previous period (no preset)", () => {
    it("computes previous week for a 7-day period", () => {
      const result = previousPeriodRange("2024-01-08", "2024-01-14");
      expect(result.from).toBe("2024-01-01");
      expect(result.to).toBe("2024-01-07");
    });

    it("computes previous month for a ~30-day period", () => {
      const result = previousPeriodRange("2024-02-01", "2024-02-29");
      expect(result.from).toBe("2024-01-03");
      expect(result.to).toBe("2024-01-31");
    });

    it("computes previous period for a single day", () => {
      const result = previousPeriodRange("2024-03-15", "2024-03-15");
      expect(result.from).toBe("2024-03-14");
      expect(result.to).toBe("2024-03-14");
    });

    it("handles year boundary", () => {
      const result = previousPeriodRange("2024-01-01", "2024-01-31");
      expect(result.from).toBe("2023-12-01");
      expect(result.to).toBe("2023-12-31");
    });

    it("formats dates with zero-padded months and days", () => {
      const result = previousPeriodRange("2024-03-01", "2024-03-07");
      expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

/**
 * Pure utility functions for the dashboard module.
 * These are NOT server actions — they are plain synchronous helpers
 * that can be safely exported without "use server".
 */

import type { PeriodPreset } from "@/components/ui/period-selector";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Compute the comparison period for KPI changes.
 * When a known preset is provided, compares with the same period one year/month/week/day ago.
 * Falls back to equal-length previous period for custom/all/unknown presets.
 */
export function previousPeriodRange(
  from: string,
  to: string,
  preset?: PeriodPreset,
): { from: string; to: string } {
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T00:00:00");

  const shiftDays = (days: number) => {
    const ms = days * 86400000;
    return { from: fmt(new Date(fromDate.getTime() - ms)), to: fmt(new Date(toDate.getTime() - ms)) };
  };

  switch (preset) {
    case "today":
      return shiftDays(1);
    case "this_week":
    case "prev_week":
      return shiftDays(7);
    case "this_month":
    case "prev_month":
      return shiftDays(30);
    case "this_year":
    case "prev_year": {
      const prevFrom = new Date(fromDate);
      prevFrom.setFullYear(prevFrom.getFullYear() - 1);
      const prevTo = new Date(toDate);
      prevTo.setFullYear(prevTo.getFullYear() - 1);
      return { from: fmt(prevFrom), to: fmt(prevTo) };
    }
    default: {
      // Fallback: equal-length previous period
      const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      const prevTo = new Date(fromDate.getTime() - 86400000);
      const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
      return { from: fmt(prevFrom), to: fmt(prevTo) };
    }
  }
}

/**
 * Pearson correlation coefficient for two arrays of numbers.
 * Returns 0 if fewer than 3 data points or zero variance.
 */
export function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

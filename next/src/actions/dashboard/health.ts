"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { cached, invalidateCache } from "@/lib/cache";
import { toDateOnly, dateToString } from "@/lib/date-utils";

export interface GarminDayPoint {
  date: string;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  steps: number | null;
  intensityMinutes: number | null;
  restingHr: number | null;
  avgStress: number | null;
  maxStress: number | null;
  fitnessAge: number | null;
  trainingReadiness: number | null;
  caloriesActive: number | null;
  caloriesResting: number | null;
}

export interface GarminSleepPoint {
  date: string;
  durationHours: number | null;
  sleepScore: number | null;
  deepHours: number | null;
  lightHours: number | null;
  remHours: number | null;
  awakeHours: number | null;
  sleepStartHour: number | null;
  sleepEndHour: number | null;
}

export interface GarminWeightPoint {
  date: string;
  weight: number | null;
  bmi: number | null;
  bodyFatPct: number | null;
}

export interface GarminHealthTrends {
  daily: GarminDayPoint[];
  sleep: GarminSleepPoint[];
  weight: GarminWeightPoint[];
}

export interface MoodTimelinePoint {
  date: string;
  level: number | null;
  sexCount: number | null;
  bjCount: number | null;
}

export interface HRVTrendPoint {
  date: string;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
}

export interface SportTimeRow {
  sport: string;
  hours: number;
  sessions: number;
}

/** Time spent per sport (sum of activity duration), sorted by hours desc, for [from, to). */
export async function getSportTimeBreakdown(from: string, to: string): Promise<SportTimeRow[]> {
  const user = await requireUser();

  return cached<SportTimeRow[]>(
    `sport-time:${user.id}:${from}:${to}`,
    900, // 15 minutes
    async () => {
      const grouped = await prisma.garminActivity.groupBy({
        by: ["activityType"],
        where: {
          userId: user.id,
          date: { gte: toDateOnly(from), lt: toDateOnly(to) },
          activityType: { not: null },
          durationSeconds: { not: null },
        },
        _sum: { durationSeconds: true },
        _count: { activityId: true },
      });

      return grouped
        .map((g) => ({
          sport: g.activityType as string,
          hours: Math.round(((g._sum.durationSeconds ?? 0) / 3600) * 10) / 10,
          sessions: g._count.activityId,
        }))
        .filter((r) => r.hours > 0)
        .sort((a, b) => b.hours - a.hours);
    },
  );
}

export async function getGarminHealthTrends(days: number = 30): Promise<GarminHealthTrends> {
  const user = await requireUser();
  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 86400000);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return cached<GarminHealthTrends>(
    `garmin-health:${user.id}:${days}:${to}`,
    900, // 15 minutes
    async () => {
      const [garminDaily, garminSleep, garminBody, withingsBody] = await Promise.all([
        prisma.garminDaily.findMany({
          where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
          select: {
            date: true,
            bodyBatteryHigh: true,
            bodyBatteryLow: true,
            steps: true,
            intensityMinutes: true,
            restingHr: true,
            avgStress: true,
            maxStress: true,
            fitnessAge: true,
            trainingReadinessScore: true,
            caloriesTotal: true,
            caloriesActive: true,
          },
          orderBy: { date: "asc" },
        }),
        prisma.garminSleep.findMany({
          where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
          select: {
            date: true,
            durationSeconds: true,
            sleepScore: true,
            deepSeconds: true,
            lightSeconds: true,
            remSeconds: true,
            awakeSeconds: true,
            sleepStart: true,
            sleepEnd: true,
          },
          orderBy: { date: "asc" },
        }),
        prisma.garminBodyComposition.findMany({
          where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
          select: { date: true, weight: true, bmi: true, bodyFatPct: true },
          orderBy: { date: "asc" },
        }),
        // Withings has much more weight data — merge with Garmin
        prisma.withingsMeasurement.findMany({
          where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, weight: { not: null } },
          select: { date: true, weight: true, bmi: true, fatRatio: true },
          orderBy: { date: "asc" },
        }),
      ]);

      const toHours = (sec: number | null) => (sec != null ? Math.round((sec / 3600) * 100) / 100 : null);
      const epochMsToHour = (ms: string | null) => {
        if (!ms) return null;
        const d = new Date(Number(ms));
        return d.getHours() + d.getMinutes() / 60;
      };

      // Merge weight data: Withings first (more data), Garmin as supplement
      // Group by date, prefer Withings values, deduplicate
      const weightByDate = new Map<string, GarminWeightPoint>();
      for (const w of garminBody) {
        const ds = dateToString(w.date);
        weightByDate.set(ds, { date: ds, weight: w.weight, bmi: w.bmi, bodyFatPct: w.bodyFatPct });
      }
      for (const w of withingsBody) {
        const ds = dateToString(w.date);
        const existing = weightByDate.get(ds);
        // Withings overrides Garmin, filter out outliers (e.g. other person's scale readings)
        if (w.weight && w.weight > 70 && w.weight < 110) {
          weightByDate.set(ds, {
            date: ds,
            weight: w.weight,
            bmi: w.bmi ?? existing?.bmi ?? null,
            bodyFatPct: w.fatRatio ?? existing?.bodyFatPct ?? null,
          });
        }
      }
      const mergedWeight = Array.from(weightByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

      return {
        daily: garminDaily.map((g) => ({
          date: dateToString(g.date),
          bodyBatteryHigh: g.bodyBatteryHigh,
          bodyBatteryLow: g.bodyBatteryLow,
          steps: g.steps,
          intensityMinutes: g.intensityMinutes,
          restingHr: g.restingHr,
          avgStress: g.avgStress,
          maxStress: g.maxStress,
          fitnessAge: g.fitnessAge,
          trainingReadiness: g.trainingReadinessScore,
          caloriesActive: g.caloriesActive,
          caloriesResting: g.caloriesTotal != null && g.caloriesActive != null ? g.caloriesTotal - g.caloriesActive : null,
        })),
        sleep: garminSleep.map((s) => ({
          date: dateToString(s.date),
          durationHours: toHours(s.durationSeconds),
          sleepScore: s.sleepScore,
          deepHours: toHours(s.deepSeconds),
          lightHours: toHours(s.lightSeconds),
          remHours: toHours(s.remSeconds),
          awakeHours: toHours(s.awakeSeconds),
          sleepStartHour: epochMsToHour(s.sleepStart),
          sleepEndHour: epochMsToHour(s.sleepEnd),
        })),
        weight: mergedWeight,
      };
    },
  );
}

export async function getHRVTrend(days: number = 30): Promise<HRVTrendPoint[]> {
  const user = await requireUser();
  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 86400000);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return cached<HRVTrendPoint[]>(
    `hrv-trend:${user.id}:${days}:${to}`,
    900, // 15 minutes
    async () => {
      const data = await prisma.garminDaily.findMany({
        where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
        select: { date: true, hrvLastNight: true, hrvWeeklyAvg: true },
        orderBy: { date: "asc" },
      });

      return data.map((d) => ({
        date: dateToString(d.date),
        hrvLastNight: d.hrvLastNight,
        hrvWeeklyAvg: d.hrvWeeklyAvg,
      }));
    },
  );
}

/** Invalidate all Garmin-related caches (call after Garmin sync) */
export async function invalidateGarminCache(userId?: number) {
  const prefix = userId ? `${userId}:` : "";
  await Promise.all([
    invalidateCache(`garmin-health:${prefix}*`),
    invalidateCache(`hrv-trend:${prefix}*`),
  ]);
}

export async function getMoodTimeline(period: {
  from: string;
  to: string;
}): Promise<MoodTimelinePoint[]> {
  const user = await requireUser();
  const { from, to } = period;

  const logs = await prisma.dailyLog.findMany({
    where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
    select: { date: true, level: true, sexCount: true, bjCount: true },
    orderBy: { date: "asc" },
  });

  return logs.map((l) => ({ date: dateToString(l.date), level: l.level, sexCount: l.sexCount ?? null, bjCount: l.bjCount ?? null }));
}

export async function getAllDailyLogs() {
  const user = await requireUser();
  const rows = await prisma.dailyLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 500,
    select: {
      id: true, date: true, level: true, moodDelta: true,
      energyLevel: true, stressLevel: true, focusQuality: true,
      kidsHours: true, sexCount: true, bjCount: true,
      alcohol: true, caffeine: true, generalNote: true,
    },
  });
  return rows.map(r => ({ ...r, date: dateToString(r.date) }));
}

/* ------------------------------------------------------------------ */
/* Screen Time                                                         */
/* ------------------------------------------------------------------ */

export interface ScreenTimeCategoryBreakdown {
  name: string;
  minutes: number;
}

export interface ScreenTimeAppEntry {
  name: string;
  minutes: number;
  category?: string;
}

export interface ScreenTimeDayPoint {
  date: string;
  totalMinutes: number;
  categories: ScreenTimeCategoryBreakdown[];
  topApps: ScreenTimeAppEntry[];
  pickups: number | null;
  notifications: number | null;
}

export interface ScreenTimeData {
  days: ScreenTimeDayPoint[];
  avgDailyMinutes: number;
  avgPickups: number;
  avgNotifications: number;
}

export async function getScreenTimeData(days: number = 7): Promise<ScreenTimeData> {
  const user = await requireUser();
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  const now = new Date();
  const fromDate = new Date(now.getTime() - safeDays * 86400000);

  const rows = await prisma.screenTime.findMany({
    where: {
      userId: user.id,
      date: { gte: fromDate },
    },
    orderBy: { date: "asc" },
  });

  const mapped: ScreenTimeDayPoint[] = rows.map((r) => {
    const cats = (r.categories ?? {}) as Record<string, number>;
    const apps = (r.topApps ?? []) as Array<{ name: string; minutes: number; category?: string }>;

    return {
      date: dateToString(r.date),
      totalMinutes: r.totalMinutes,
      categories: Object.entries(cats).map(([name, minutes]) => ({ name, minutes })),
      topApps: apps.slice(0, 5),
      pickups: r.pickups,
      notifications: r.notifications,
    };
  });

  const count = mapped.length || 1;
  const avgDailyMinutes = Math.round(mapped.reduce((s, d) => s + d.totalMinutes, 0) / count);
  const avgPickups = Math.round(
    mapped.reduce((s, d) => s + (d.pickups ?? 0), 0) / count,
  );
  const avgNotifications = Math.round(
    mapped.reduce((s, d) => s + (d.notifications ?? 0), 0) / count,
  );

  return { days: mapped, avgDailyMinutes, avgPickups, avgNotifications };
}

/* ------------------------------------------------------------------ */
/* Kids Time                                                           */
/* ------------------------------------------------------------------ */

export interface KidsTimeDayPoint {
  date: string;
  minutes: number;
}

export interface KidsTimeData {
  days: KidsTimeDayPoint[];
  avgDailyMinutes: number;
  totalDays: number;
}

export async function getKidsTimeData(days: number = 30): Promise<KidsTimeData> {
  const user = await requireUser();
  const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
  const now = new Date();
  const fromDate = new Date(now.getTime() - safeDays * 86400000);

  const rows = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      date: { gte: fromDate },
      kidsHours: { not: null },
    },
    orderBy: { date: "asc" },
    select: { date: true, kidsHours: true },
  });

  const mapped: KidsTimeDayPoint[] = rows
    .filter((r) => r.kidsHours != null && Number.isFinite(r.kidsHours))
    .map((r) => ({
      date: dateToString(r.date),
      minutes: Math.round((r.kidsHours as number) * 60),
    }));

  const count = mapped.length || 1;
  const avgDailyMinutes = Math.round(mapped.reduce((s, d) => s + d.minutes, 0) / count);

  return { days: mapped, avgDailyMinutes, totalDays: mapped.length };
}

export async function getFullMoodTimeline(): Promise<MoodTimelinePoint[]> {
  const user = await requireUser();
  const logs = await prisma.dailyLog.findMany({
    where: { userId: user.id },
    select: { date: true, level: true, sexCount: true, bjCount: true },
    orderBy: { date: "asc" },
    take: 1000,
  });
  return logs.map((l) => ({ date: dateToString(l.date), level: l.level, sexCount: l.sexCount ?? null, bjCount: l.bjCount ?? null }));
}

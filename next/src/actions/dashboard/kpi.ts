"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { cached, invalidateCache } from "@/lib/cache";
import { previousPeriodRange } from "./utils";
import type { PeriodPreset } from "@/components/ui/period-selector";
import { toDateOnly } from "@/lib/date-utils";
import { notTransfer } from "@/actions/finance/finance-utils";

export interface KpiPeriodData {
  income: number;
  expenses: number;
  savingsRate: number;
  avgSteps: number;
  avgSleepScore: number;
  avgRestingHr: number;
  avgBodyBattery: number;
  latestWeight: number | null;
  gymSessions: number;
  totalWorkoutMinutes: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgDailyCalories: number;
  totalSex: number;
  totalBj: number;
}

export interface DashboardKPIs {
  finance: {
    income: number;
    expenses: number;
    savingsRate: number;
  };
  health: {
    avgSteps: number;
    avgSleepScore: number;
    avgRestingHr: number;
    avgBodyBattery: number;
    latestWeight: number | null;
  };
  fitness: {
    gymSessions: number;
    totalWorkoutMinutes: number;
  };
  lifestyle: {
    avgMood: number | null;
    avgEnergy: number | null;
    avgStress: number | null;
    avgFocus: number | null;
    avgAlcohol: number | null;
    avgCaffeine: number | null;
    totalSex: number;
    totalBj: number;
    moodDistribution: {
      negativePct: number;
      neutralPct: number;
      positivePct: number;
    } | null;
  };
  food: {
    avgDailyCalories: number;
  };
  previousPeriod: KpiPeriodData | null;
}

async function fetchKpiPeriodData(
  userId: number,
  from: string,
  to: string,
): Promise<KpiPeriodData> {
  const [
    incomeAgg,
    expenseAgg,
    garminAgg,
    sleepAgg,
    latestWeight,
    gymAgg,
    gymMinutesAgg,
    dailyLogAgg,
    foodAgg,
    foodDayCount,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, type: "INCOME", ...notTransfer },
      _sum: { amountEur: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, type: "EXPENSE", ...notTransfer },
      _sum: { amountEur: true },
    }),
    prisma.garminDaily.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      _avg: { steps: true, restingHr: true, bodyBatteryHigh: true },
    }),
    prisma.garminSleep.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      _avg: { sleepScore: true },
    }),
    prisma.withingsMeasurement.findFirst({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) }, weight: { not: null } },
      orderBy: { date: "desc" },
      select: { weight: true },
    }),
    prisma.gymWorkout.count({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
    }),
    prisma.gymWorkout.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      _sum: { durationMinutes: true },
    }),
    prisma.dailyLog.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      _avg: { level: true, energyLevel: true, stressLevel: true, focusQuality: true, alcohol: true, caffeine: true },
      _sum: { sexCount: true, bjCount: true },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.foodLog.aggregate({
      where: { userId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } as any },
      _sum: { calories: true },
    }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT date) as count FROM food_log WHERE user_id = ${userId} AND date >= ${from}::date AND date <= ${to}::date
    `,
  ]);

  const income = Math.abs(incomeAgg._sum.amountEur ?? 0);
  const expenses = Math.abs(expenseAgg._sum.amountEur ?? 0);
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  const totalCalories = foodAgg._sum.calories ?? 0;
  const daysWithFood = Number(foodDayCount[0]?.count ?? 0);

  return {
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    savingsRate: Math.round(savingsRate),
    avgSteps: Math.round(garminAgg._avg.steps ?? 0),
    avgSleepScore: Math.round(sleepAgg._avg.sleepScore ?? 0),
    avgRestingHr: Math.round(garminAgg._avg.restingHr ?? 0),
    avgBodyBattery: Math.round(garminAgg._avg.bodyBatteryHigh ?? 0),
    latestWeight: latestWeight?.weight ?? null,
    gymSessions: gymAgg,
    totalWorkoutMinutes: gymMinutesAgg._sum.durationMinutes ?? 0,
    avgMood: dailyLogAgg._avg.level ? Math.round(dailyLogAgg._avg.level * 10) / 10 : null,
    avgEnergy: dailyLogAgg._avg.energyLevel ? Math.round(dailyLogAgg._avg.energyLevel * 10) / 10 : null,
    avgDailyCalories: daysWithFood > 0 ? Math.round(totalCalories / daysWithFood) : 0,
    totalSex: dailyLogAgg._sum.sexCount ?? 0,
    totalBj: dailyLogAgg._sum.bjCount ?? 0,
  };
}

export async function getDashboardKPIs(period: {
  from: string;
  to: string;
  preset?: PeriodPreset;
}): Promise<DashboardKPIs> {
  const user = await requireUser();
  const { from, to, preset } = period;

  return cached<DashboardKPIs>(
    `kpi:${user.id}:${from}:${to}:${preset ?? ""}`,
    300, // 5 minutes
    async () => {
      const prevRange = previousPeriodRange(from, to, preset);

      const [current, previous] = await Promise.all([
        fetchKpiPeriodData(user.id, from, to),
        fetchKpiPeriodData(user.id, prevRange.from, prevRange.to),
      ]);

      // Also fetch full lifestyle aggregates for current period
      const [dailyLogAgg, moodDistRaw] = await Promise.all([
        prisma.dailyLog.aggregate({
          where: { userId: user.id, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
          _avg: {
            level: true,
            energyLevel: true,
            stressLevel: true,
            focusQuality: true,
            alcohol: true,
            caffeine: true,
          },
        }),
        prisma.$queryRaw<[{ negative: bigint; neutral: bigint; positive: bigint; total: bigint }]>`
          SELECT
            COUNT(*) FILTER (WHERE level >= -5 AND level <= -2) AS negative,
            COUNT(*) FILTER (WHERE level > -2 AND level <= 2) AS neutral,
            COUNT(*) FILTER (WHERE level > 2 AND level <= 5) AS positive,
            COUNT(*) FILTER (WHERE level IS NOT NULL) AS total
          FROM daily_log
          WHERE user_id = ${user.id}
            AND date >= ${from}::date
            AND date <= ${to}::date
        `,
      ]);

      const moodRow = moodDistRaw[0];
      const moodTotal = Number(moodRow?.total ?? 0);
      const moodDistribution = moodTotal > 0
        ? {
            negativePct: Math.round((Number(moodRow.negative) / moodTotal) * 1000) / 10,
            neutralPct: Math.round((Number(moodRow.neutral) / moodTotal) * 1000) / 10,
            positivePct: Math.round((Number(moodRow.positive) / moodTotal) * 1000) / 10,
          }
        : null;

      return {
        finance: {
          income: current.income,
          expenses: current.expenses,
          savingsRate: current.savingsRate,
        },
        health: {
          avgSteps: current.avgSteps,
          avgSleepScore: current.avgSleepScore,
          avgRestingHr: current.avgRestingHr,
          avgBodyBattery: current.avgBodyBattery,
          latestWeight: current.latestWeight,
        },
        fitness: {
          gymSessions: current.gymSessions,
          totalWorkoutMinutes: current.totalWorkoutMinutes,
        },
        lifestyle: {
          avgMood: dailyLogAgg._avg.level
            ? Math.round(dailyLogAgg._avg.level * 10) / 10
            : null,
          avgEnergy: dailyLogAgg._avg.energyLevel
            ? Math.round(dailyLogAgg._avg.energyLevel * 10) / 10
            : null,
          avgStress: dailyLogAgg._avg.stressLevel
            ? Math.round(dailyLogAgg._avg.stressLevel * 10) / 10
            : null,
          avgFocus: dailyLogAgg._avg.focusQuality
            ? Math.round(dailyLogAgg._avg.focusQuality * 10) / 10
            : null,
          avgAlcohol: dailyLogAgg._avg.alcohol
            ? Math.round(dailyLogAgg._avg.alcohol * 10) / 10
            : null,
          avgCaffeine: dailyLogAgg._avg.caffeine
            ? Math.round(dailyLogAgg._avg.caffeine * 10) / 10
            : null,
          totalSex: current.totalSex,
          totalBj: current.totalBj,
          moodDistribution,
        },
        food: {
          avgDailyCalories: current.avgDailyCalories,
        },
        previousPeriod: previous,
      };
    },
  );
}

/** Invalidate all KPI caches (call after data changes) */
export async function invalidateKpiCache(userId?: number) {
  const pattern = userId ? `kpi:${userId}:*` : "kpi:*";
  return invalidateCache(pattern);
}

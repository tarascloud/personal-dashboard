"use server";

import { prisma } from "@/lib/db";
import { requireUser, requireNonDemoUser } from "@/lib/current-user";

/**
 * Athlete profile — контекст для персонального тренера (агент "Трен").
 * Зберігається як JSON у user_preferences під ключем `athlete_profile`.
 * Дані, яких немає в gym_* / garmin_* таблицях (зріст, дата народження,
 * травми, обладнання, цілі харчування тощо). bodyweightKg тут — ручний
 * fallback, бо Garmin body-composition sync вимкнено (429 rate-limit).
 */

const PROFILE_KEY = "athlete_profile";

export type AthleteProfile = {
  heightCm: number | null;
  birthDate: string | null; // YYYY-MM-DD
  sex: "male" | "female" | null;
  bodyweightKg: number | null;
  bodyFatPct: number | null;
  experience: "beginner" | "intermediate" | "advanced" | null;
  goal: "hypertrophy" | "strength" | "recomp" | "maintenance" | null;
  nutritionTarget: "bulk" | "cut" | "recomp" | "maintain" | null;
  weeklyDaysTarget: number | null;
  rirTarget: number | null;
  deloadWeeks: number | null;
  proteinTargetG: number | null;
  caloriesTarget: number | null;
  injuries: string | null;
  equipment: string | null;
  activities: string | null;
  updatedAt: string | null;
};

const EMPTY: AthleteProfile = {
  heightCm: null,
  birthDate: null,
  sex: null,
  bodyweightKg: null,
  bodyFatPct: null,
  experience: null,
  goal: null,
  nutritionTarget: null,
  weeklyDaysTarget: null,
  rirTarget: null,
  deloadWeeks: null,
  proteinTargetG: null,
  caloriesTarget: null,
  injuries: null,
  equipment: null,
  activities: null,
  updatedAt: null,
};

export async function getAthleteProfile(): Promise<AthleteProfile> {
  const user = await requireUser();
  const [blob, legacyGoal] = await Promise.all([
    prisma.userPreference.findUnique({
      where: { userId_key: { userId: user.id, key: PROFILE_KEY } },
    }),
    prisma.userPreference.findUnique({
      where: { userId_key: { userId: user.id, key: "gym_goal" } },
    }),
  ]);

  let parsed: Partial<AthleteProfile> = {};
  if (blob?.value) {
    try {
      parsed = JSON.parse(blob.value) as Partial<AthleteProfile>;
    } catch (e) {
      console.error("[gym/getAthleteProfile] JSON parse error:", e);
    }
  }

  // Backward-compat: fall back to standalone gym_goal preference.
  const goal =
    (parsed.goal as AthleteProfile["goal"]) ??
    (legacyGoal?.value as AthleteProfile["goal"]) ??
    null;

  return { ...EMPTY, ...parsed, goal };
}

export async function setAthleteProfile(
  data: Partial<AthleteProfile>,
): Promise<void> {
  await requireNonDemoUser();
  const user = await requireUser();

  const current = await getAthleteProfile();
  const merged: AthleteProfile = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const value = JSON.stringify(merged);

  await prisma.userPreference.upsert({
    where: { userId_key: { userId: user.id, key: PROFILE_KEY } },
    update: { value },
    create: { userId: user.id, key: PROFILE_KEY, value },
  });

  // Keep standalone gym_goal in sync for existing consumers.
  if (data.goal) {
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: user.id, key: "gym_goal" } },
      update: { value: data.goal },
      create: { userId: user.id, key: "gym_goal", value: data.goal },
    });
  }
}

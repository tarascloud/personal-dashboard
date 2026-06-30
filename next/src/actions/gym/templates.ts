"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { updateTag } from "next/cache";
import { toDateOnly, dateToString } from "@/lib/date-utils";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Start a workout from a program day template
export async function startWorkoutFromTemplate(programDayId: number, date: string) {
  const user = await requireUser();
  const day = await prisma.gymProgramDay.findUnique({
    where: { id: programDayId },
    include: {
      exercises: {
        orderBy: { orderNum: "asc" },
        include: { exercise: true },
      },
      program: true,
    },
  });
  if (!day || day.program.userId !== user.id) throw new Error("Not found");

  const now = new Date();
  const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const workout = await prisma.gymWorkout.create({
    data: {
      userId: user.id,
      date: toDateOnly(date),
      workoutName: `${day.program.name} — ${day.dayName}`,
      programType: day.focus || null,
      startTime,
    },
  });

  // Add all exercises from template (no empty sets — user copies sets from the
  // previous workout instead of filling blank scaffolded rows)
  await prisma.gymWorkoutExercise.createMany({
    data: day.exercises.map((pe) => ({
      userId: user.id,
      workoutId: workout.id,
      exerciseId: pe.exerciseId,
      orderNum: pe.orderNum,
    })),
  });

  updateTag(CACHE_TAGS.gym);
  return workout;
}

// Map of programDayId -> last completed session that matches that day,
// so the start dialog can offer a "repeat last session" option per day.
export async function getLastSessionsByDay(): Promise<
  Record<number, { workoutId: number; exerciseCount: number; date: string }>
> {
  const user = await requireUser();
  const programs = await prisma.gymProgram.findMany({
    where: { userId: user.id },
    include: { days: { select: { id: true, dayName: true } } },
  });

  // The template start sets workoutName to `${program.name} — ${day.dayName}`,
  // so match completed sessions back to a day by that exact name.
  const dayIdByName = new Map<string, number>();
  for (const prog of programs) {
    for (const day of prog.days) {
      dayIdByName.set(`${prog.name} — ${day.dayName}`, day.id);
    }
  }
  const names = [...dayIdByName.keys()];
  if (names.length === 0) return {};

  const workouts = await prisma.gymWorkout.findMany({
    where: { userId: user.id, endTime: { not: null }, workoutName: { in: names } },
    orderBy: { date: "desc" },
    include: { _count: { select: { exercises: true } } },
  });

  const result: Record<number, { workoutId: number; exerciseCount: number; date: string }> = {};
  for (const w of workouts) {
    if (!w.workoutName) continue;
    const dayId = dayIdByName.get(w.workoutName);
    // workouts ordered date desc → first hit per day is the most recent
    if (dayId !== undefined && !(dayId in result) && w._count.exercises > 0) {
      result[dayId] = { workoutId: w.id, exerciseCount: w._count.exercises, date: dateToString(w.date) };
    }
  }
  return result;
}

// Start a workout by copying the exercises (and set scaffold) of the most
// recent completed session that matches this program day. Falls back to the
// program template when no prior session exists.
export async function startWorkoutFromLastSession(programDayId: number, date: string) {
  const user = await requireUser();
  const day = await prisma.gymProgramDay.findUnique({
    where: { id: programDayId },
    include: { program: true },
  });
  if (!day || day.program.userId !== user.id) throw new Error("Not found");

  const workoutName = `${day.program.name} — ${day.dayName}`;
  const last = await prisma.gymWorkout.findFirst({
    where: { userId: user.id, endTime: { not: null }, workoutName },
    orderBy: { date: "desc" },
    include: {
      exercises: { orderBy: { orderNum: "asc" } },
    },
  });

  // No prior session to repeat → fall back to the program template
  if (!last || last.exercises.length === 0) {
    return startWorkoutFromTemplate(programDayId, date);
  }

  const now = new Date();
  const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const workout = await prisma.gymWorkout.create({
    data: {
      userId: user.id,
      date: toDateOnly(date),
      workoutName,
      programType: day.focus || null,
      startTime,
    },
  });

  // Copy the exercises from the last session (no empty sets — user copies sets
  // from the previous workout on demand).
  await prisma.gymWorkoutExercise.createMany({
    data: last.exercises.map((we) => ({
      userId: user.id,
      workoutId: workout.id,
      exerciseId: we.exerciseId,
      orderNum: we.orderNum,
      supersetGroup: we.supersetGroup,
    })),
  });

  updateTag(CACHE_TAGS.gym);
  return workout;
}

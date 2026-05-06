"use client";

import { useTransition } from "react";
import { todayString } from "@/lib/date-utils";
import {
  createWorkout,
  completeWorkout,
  deleteWorkout,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  reorderExercises,
  addSet,
  updateSet,
  deleteSet,
  getExercises,
  getGymStats,
  getExercisePRs,
  toggleFavoriteExercise,
  getRecentGarminActivities,
  linkGarminActivity,
  unlinkGarminActivity,
  getLastSetsForExercise,
  startWorkoutFromTemplate,
  updateWorkout,
  addDefaultExercise,
  getWorkouts,
} from "@/actions/gym";
import type { GymExercise, GymSet, GymWorkout, GymWorkoutExercise } from "@/types/gym";
import type { GarminActivityItem } from "@/types/gym";
import type { GymAction } from "./gym-reducer";
import type { useSessionTimer } from "./use-session-timer";

type SessionTimer = ReturnType<typeof useSessionTimer>;

interface UseGymHandlersParams {
  state: {
    activeWorkout: GymWorkout | null;
    exercisePickerOpen: boolean;
    showGarminLink: boolean;
    editWeight: string;
    editReps: string;
    editIntensity: string;
    editWorkoutName: string;
    editWorkoutDate: string;
    prCache: Record<number, { maxWeight: number | null; maxWeightReps: number | null; maxVolume: number | null; maxVolumeWeight: number | null; maxVolumeReps: number | null }>;
  };
  dispatch: React.Dispatch<GymAction>;
  timer: SessionTimer;
}

export function useGymHandlers({ state, dispatch, timer }: UseGymHandlersParams) {
  const [isPending, startTransition] = useTransition();
  const { activeWorkout, editWeight, editReps, editIntensity, editWorkoutName, editWorkoutDate, prCache } = state;

  function refreshActiveWorkout() {
    return startTransition(async () => {
      const full = await getWorkouts(20);
      dispatch({ type: "REFRESH_WORKOUTS", workouts: full as GymWorkout[] });
    });
  }

  function reloadWorkouts() {
    startTransition(async () => {
      const ws = await getWorkouts(20);
      dispatch({ type: "REFRESH_WORKOUTS", workouts: ws as GymWorkout[] });
    });
  }

  function reloadStats() {
    startTransition(async () => {
      const s = await getGymStats({ from: todayString().slice(0, 8) + "01", to: todayString() });
      dispatch({ type: "SET_STATS", stats: s });
    });
  }

  function handleStartWorkout() {
    startTransition(async () => {
      const w = await createWorkout({ date: todayString() });
      const full = await getWorkouts(20);
      const active = (full as GymWorkout[]).find((wk) => wk.id === w.id);
      const fallback = (full as GymWorkout[]).find((wk) => !wk.endTime);
      dispatch({ type: "START_WORKOUT", workouts: full as GymWorkout[], activeWorkout: (active ?? fallback) as GymWorkout });
      timer.reset();
      timer.start();
    });
  }

  function handleCompleteWorkout() {
    if (!activeWorkout) return;
    const duration = timer.durationMinutes;
    const completedId = activeWorkout.id;
    startTransition(async () => {
      await completeWorkout(completedId, duration);
      timer.stop();
      dispatch({ type: "COMPLETE_WORKOUT", completedId });
      handleRefreshGarminActivities();
      reloadWorkouts();
      reloadStats();
    });
  }

  function handleDeleteWorkout(id: number) {
    startTransition(async () => {
      await deleteWorkout(id);
      if (activeWorkout?.id === id) {
        dispatch({ type: "SET_ACTIVE_WORKOUT", workout: null });
        timer.stop();
        dispatch({ type: "SET_ACTIVE_TAB", tab: "workouts" });
      }
      reloadWorkouts();
      reloadStats();
    });
  }

  function handleToggleFavorite(exerciseId: number) {
    startTransition(async () => {
      const newState = await toggleFavoriteExercise(exerciseId);
      dispatch(newState ? { type: "ADD_FAVORITE", exerciseId } : { type: "REMOVE_FAVORITE", exerciseId });
    });
  }

  function handleLinkGarmin(workoutId: number, garminActivityId: number) {
    startTransition(async () => {
      await linkGarminActivity(workoutId, garminActivityId);
      dispatch({ type: "CLOSE_GARMIN_LINK" });
      reloadWorkouts();
    });
  }

  function handleUnlinkGarmin(workoutId: number) {
    startTransition(async () => {
      await unlinkGarminActivity(workoutId);
      reloadWorkouts();
    });
  }

  function handleRefreshGarminActivities() {
    startTransition(async () => {
      const activities = await getRecentGarminActivities();
      dispatch({ type: "SET_GARMIN_ACTIVITIES", activities: activities as GarminActivityItem[] });
    });
  }

  function handleAddExerciseToWorkout(exerciseId: number) {
    if (!activeWorkout) return;
    const orderNum = activeWorkout.exercises.length;
    startTransition(async () => {
      const we = await addExerciseToWorkout(activeWorkout.id, exerciseId, orderNum);
      const newExercise: GymWorkoutExercise = {
        id: we.id, workoutId: activeWorkout.id, exerciseId: we.exerciseId,
        orderNum: we.orderNum, notes: null, supersetGroup: null, exercise: we.exercise as GymExercise, sets: [],
      };
      dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: [...w.exercises, newExercise] }) });
      dispatch({ type: "CLOSE_EXERCISE_PICKER" });
      try {
        const pr = await getExercisePRs(exerciseId);
        dispatch({ type: "SET_PR_CACHE", exerciseId, pr });
      } catch { /* ignore */ }
    });
  }

  function handleRemoveExercise(workoutExerciseId: number) {
    startTransition(async () => {
      await removeExerciseFromWorkout(workoutExerciseId);
      dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== workoutExerciseId) }) });
    });
  }

  function handleAddSet(workoutExerciseId: number, existingSetsCount: number) {
    startTransition(async () => {
      const newSet = await addSet(workoutExerciseId, { setNum: existingSetsCount + 1 });
      const gymSet: GymSet = {
        id: newSet.id, workoutExerciseId: newSet.workoutExerciseId, setNum: newSet.setNum,
        weightKg: newSet.weightKg as number | null, reps: newSet.reps as number | null,
        isWarmup: newSet.isWarmup, isFailure: newSet.isFailure, rpe: newSet.rpe as number | null,
        notes: null, intensity: newSet.intensity,
      };
      dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: w.exercises.map((e) => e.id === workoutExerciseId ? { ...e, sets: [...e.sets, gymSet] } : e) }) });
    });
  }

  function handleEditSet(set: GymSet) {
    dispatch({ type: "START_EDIT_SET", set });
  }

  function handleSaveSet(setId: number, exerciseId: number) {
    startTransition(async () => {
      const weightVal = editWeight ? parseFloat(editWeight) : null;
      const repsVal = editReps ? parseInt(editReps) : null;
      await updateSet(setId, { weightKg: weightVal, reps: repsVal, intensity: editIntensity || "normal" });
      dispatch({ type: "FINISH_EDIT_SET" });
      if (weightVal && repsVal && prCache[exerciseId]) {
        const pr = prCache[exerciseId];
        const isWeightPR = pr.maxWeight !== null && weightVal > pr.maxWeight;
        const volume = weightVal * repsVal;
        const isVolumePR = pr.maxVolume !== null && volume > pr.maxVolume;
        if (isWeightPR || isVolumePR) {
          dispatch({ type: "SET_NEW_PR", setId, prs: { weight: isWeightPR, volume: isVolumePR } });
          dispatch({ type: "UPDATE_PR_CACHE", exerciseId, updater: (prev) => ({
            ...prev,
            maxWeight: isWeightPR ? weightVal : prev.maxWeight,
            maxWeightReps: isWeightPR ? repsVal : prev.maxWeightReps,
            maxVolume: isVolumePR ? volume : prev.maxVolume,
            maxVolumeWeight: isVolumePR ? weightVal : prev.maxVolumeWeight,
            maxVolumeReps: isVolumePR ? repsVal : prev.maxVolumeReps,
          }) });
        }
      }
      const updater = (w: GymWorkout) => ({
        ...w,
        exercises: w.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => s.id === setId ? {
            ...s, weightKg: weightVal, reps: repsVal, intensity: editIntensity || "normal",
            isWarmup: editIntensity === "warmup", isFailure: editIntensity === "tech-fail" || editIntensity === "full-fail",
          } : s),
        })),
      });
      if (activeWorkout) { dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater }); }
      else { dispatch({ type: "UPDATE_ALL_WORKOUTS", updater }); }
    });
  }

  function handleDeleteSet(setId: number) {
    startTransition(async () => {
      await deleteSet(setId);
      const updater = (w: GymWorkout) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) })) });
      if (activeWorkout?.exercises.some((e) => e.sets.some((s) => s.id === setId))) {
        dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater });
      } else {
        dispatch({ type: "UPDATE_ALL_WORKOUTS", updater });
      }
    });
  }

  function handleStartEditWorkout(workout: GymWorkout) {
    dispatch({ type: "START_EDIT_WORKOUT", workout });
  }

  function handleSaveWorkout(workoutId: number) {
    startTransition(async () => {
      await updateWorkout(workoutId, { workoutName: editWorkoutName || undefined, date: editWorkoutDate || undefined });
      dispatch({ type: "FINISH_EDIT_WORKOUT" });
      dispatch({ type: "UPDATE_WORKOUT_BY_ID", workoutId, updater: (w) => ({ ...w, workoutName: editWorkoutName || w.workoutName, date: editWorkoutDate || w.date }) });
    });
  }

  function handleAddExerciseToHistoryWorkout(workoutId: number, exerciseId: number, currentCount: number) {
    startTransition(async () => {
      const we = await addExerciseToWorkout(workoutId, exerciseId, currentCount);
      const newExercise: GymWorkoutExercise = {
        id: we.id, workoutId, exerciseId: we.exerciseId, orderNum: we.orderNum,
        notes: null, supersetGroup: null, exercise: we.exercise as GymExercise, sets: [],
      };
      dispatch({ type: "UPDATE_WORKOUT_BY_ID", workoutId, updater: (w) => ({ ...w, exercises: [...w.exercises, newExercise] }) });
    });
  }

  function handleAddDefaultExerciseToActive(exerciseName: string) {
    if (!activeWorkout) return;
    const orderNum = activeWorkout.exercises.length;
    startTransition(async () => {
      await addDefaultExercise(exerciseName);
      const ex = await getExercises();
      dispatch({ type: "SET_EXERCISES", exercises: ex as GymExercise[] });
      const added = (ex as GymExercise[]).find((e) => e.name === exerciseName);
      if (added) {
        const we = await addExerciseToWorkout(activeWorkout.id, added.id, orderNum);
        const newExercise: GymWorkoutExercise = {
          id: we.id, workoutId: activeWorkout.id, exerciseId: we.exerciseId, orderNum: we.orderNum,
          notes: null, supersetGroup: null, exercise: we.exercise as GymExercise, sets: [],
        };
        dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: [...w.exercises, newExercise] }) });
      }
      dispatch({ type: "CLOSE_EXERCISE_PICKER" });
    });
  }

  function handleAddDefaultExerciseToHistory(workoutId: number, exerciseCount: number, exerciseName: string) {
    startTransition(async () => {
      await addDefaultExercise(exerciseName);
      const ex = await getExercises();
      dispatch({ type: "SET_EXERCISES", exercises: ex as GymExercise[] });
      const added = (ex as GymExercise[]).find((e) => e.name === exerciseName);
      if (added) {
        const we = await addExerciseToWorkout(workoutId, added.id, exerciseCount);
        const newExercise: GymWorkoutExercise = {
          id: we.id, workoutId, exerciseId: we.exerciseId, orderNum: we.orderNum,
          notes: null, supersetGroup: null, exercise: we.exercise as GymExercise, sets: [],
        };
        dispatch({ type: "UPDATE_WORKOUT_BY_ID", workoutId, updater: (w) => ({ ...w, exercises: [...w.exercises, newExercise] }) });
      }
    });
  }

  function handleRemoveExerciseFromHistory(workoutExerciseId: number) {
    startTransition(async () => {
      await removeExerciseFromWorkout(workoutExerciseId);
      dispatch({ type: "UPDATE_ALL_WORKOUTS", updater: (w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== workoutExerciseId) }) });
    });
  }

  function handleAddSetToHistory(workoutExerciseId: number, currentSetCount: number) {
    startTransition(async () => {
      const newSet = await addSet(workoutExerciseId, { setNum: currentSetCount + 1 });
      const gymSet: GymSet = {
        id: newSet.id, workoutExerciseId: newSet.workoutExerciseId, setNum: newSet.setNum,
        weightKg: newSet.weightKg as number | null, reps: newSet.reps as number | null,
        isWarmup: newSet.isWarmup, isFailure: newSet.isFailure, rpe: newSet.rpe as number | null,
        notes: null, intensity: newSet.intensity,
      };
      dispatch({ type: "UPDATE_ALL_WORKOUTS", updater: (w) => ({ ...w, exercises: w.exercises.map((e) => e.id === workoutExerciseId ? { ...e, sets: [...e.sets, gymSet] } : e) }) });
    });
  }

  function handleCopyPreviousSet(
    workoutExerciseId: number,
    existingSetsCount: number,
    data: { weightKg?: number; reps?: number; intensity?: string }
  ) {
    startTransition(async () => {
      const newSet = await addSet(workoutExerciseId, {
        setNum: existingSetsCount + 1,
        weightKg: data.weightKg,
        reps: data.reps,
        intensity: data.intensity,
      });
      const gymSet: GymSet = {
        id: newSet.id, workoutExerciseId: newSet.workoutExerciseId, setNum: newSet.setNum,
        weightKg: newSet.weightKg as number | null, reps: newSet.reps as number | null,
        isWarmup: newSet.isWarmup, isFailure: newSet.isFailure, rpe: newSet.rpe as number | null,
        notes: null, intensity: newSet.intensity,
      };
      dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: w.exercises.map((e) => e.id === workoutExerciseId ? { ...e, sets: [...e.sets, gymSet] } : e) }) });
    });
  }

  function handleLoadPrevious(workoutExerciseId: number, exerciseId: number) {
    startTransition(async () => {
      const prevSets = await getLastSetsForExercise(exerciseId, activeWorkout?.id);
      if (prevSets.length === 0) return;
      const createdSets: GymSet[] = [];
      for (const ps of prevSets) {
        const newSet = await addSet(workoutExerciseId, { setNum: ps.setNum, weightKg: ps.weightKg ?? undefined, reps: ps.reps ?? undefined, rpe: ps.rpe ?? undefined });
        createdSets.push({
          id: newSet.id, workoutExerciseId: newSet.workoutExerciseId, setNum: newSet.setNum,
          weightKg: newSet.weightKg as number | null, reps: newSet.reps as number | null,
          isWarmup: newSet.isWarmup, isFailure: newSet.isFailure, rpe: newSet.rpe as number | null,
          notes: null, intensity: newSet.intensity,
        });
      }
      dispatch({ type: "UPDATE_ACTIVE_WORKOUT", updater: (w) => ({ ...w, exercises: w.exercises.map((e) => e.id === workoutExerciseId ? { ...e, sets: [...e.sets, ...createdSets] } : e) }) });
    });
  }

  function handleReorderExercises(exerciseIds: number[]) {
    if (!activeWorkout) return;
    const workoutId = activeWorkout.id;
    // Optimistic: reorder exercises in local state immediately
    dispatch({
      type: "UPDATE_ACTIVE_WORKOUT",
      updater: (w) => {
        const exerciseMap = new Map(w.exercises.map((e) => [e.id, e]));
        const reordered = exerciseIds
          .map((id, idx) => {
            const ex = exerciseMap.get(id);
            return ex ? { ...ex, orderNum: idx } : null;
          })
          .filter(Boolean) as typeof w.exercises;
        return { ...w, exercises: reordered };
      },
    });
    // Persist to server
    startTransition(async () => {
      await reorderExercises(workoutId, exerciseIds);
    });
  }

  return {
    isPending,
    startTransition,
    refreshActiveWorkout,
    reloadWorkouts,
    reloadStats,
    handleStartWorkout,
    handleCompleteWorkout,
    handleDeleteWorkout,
    handleToggleFavorite,
    handleLinkGarmin,
    handleUnlinkGarmin,
    handleRefreshGarminActivities,
    handleAddExerciseToWorkout,
    handleRemoveExercise,
    handleAddSet,
    handleCopyPreviousSet,
    handleEditSet,
    handleSaveSet,
    handleDeleteSet,
    handleStartEditWorkout,
    handleSaveWorkout,
    handleAddExerciseToHistoryWorkout,
    handleAddDefaultExerciseToActive,
    handleAddDefaultExerciseToHistory,
    handleRemoveExerciseFromHistory,
    handleAddSetToHistory,
    handleLoadPrevious,
    handleReorderExercises,
  };
}

export type { SessionTimer };

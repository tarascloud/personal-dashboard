"use client";

import { useReducer, useTransition, useCallback, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { todayString } from "@/lib/date-utils";
import {
  getWorkouts,
  getGymStats,
  startWorkoutFromTemplate,
  createWorkout,
} from "@/actions/gym";
import type { CalendarDayData } from "@/actions/gym";
import { RecoveryChips, type MuscleRecoveryItem } from "./recovery-chips";
import { PeriodSelector, type PeriodPreset } from "@/components/ui/period-selector";
import { WorkoutRecommendation } from "./workout-recommendation";
import { WorkoutCalendar } from "./workout-calendar";
import { GarminActivityLinker } from "./garmin-activity-linker";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { StartWorkoutDialog } from "./start-workout-dialog";
import { WorkoutHistory } from "./workout-history";
import { ActiveWorkoutPanel } from "./active-workout-panel";
import { usePageShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSessionTimer } from "./use-session-timer";
import { getWorkoutRecommendation } from "./gym-types";
import { useGymHandlers } from "./use-gym-handlers";
import type { GarminActivityItem, GymProgram, GymStats, GymExercise, GymWorkout } from "@/types/gym";
import { gymReducer, createInitialState } from "./gym-reducer";

export function GymPage({
  initialWorkouts,
  initialExercises,
  initialStats,
  initialPrograms,
  initialMuscleRecovery,
  initialCalendarData,
  initialCalendarYear,
  initialCalendarMonth,
  initialFavoriteIds,
  initialGarminActivities,
}: {
  initialWorkouts: GymWorkout[];
  initialExercises: GymExercise[];
  initialStats: GymStats;
  initialPrograms: GymProgram[];
  initialMuscleRecovery: MuscleRecoveryItem[];
  initialCalendarData: CalendarDayData[];
  initialCalendarYear: number;
  initialCalendarMonth: number;
  initialFavoriteIds: number[];
  initialGarminActivities: GarminActivityItem[];
}) {
  const t = useTranslations("gym");

  const [state, dispatch] = useReducer(
    gymReducer,
    { initialWorkouts, initialExercises, initialStats, initialPrograms, initialFavoriteIds, initialGarminActivities },
    createInitialState,
  );

  const [, startTransition] = useTransition();
  const timer = useSessionTimer();

  const {
    workouts, exercises, stats, programs, activeWorkout, periodPreset, customFrom, customTo,
    expandedWorkoutId, historyOpen, exercisePickerOpen, exerciseSearch, exerciseMuscleFilter,
    favoriteIds, garminActivities, showGarminLink, justCompletedWorkoutId, editingSetId,
    editWeight, editReps, editIntensity, editingWorkoutId, editWorkoutName, editWorkoutDate,
    prCache, newPRs, startDialogOpen,
  } = state;

  const handlers = useGymHandlers({ state, dispatch, timer });

  // Auto-start timer when active workout exists
  useEffect(() => {
    if (activeWorkout && !timer.isRunning && timer.elapsedSeconds === 0) timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkout]);

  const handlePeriodChange = useCallback((preset: PeriodPreset, range: { dateFrom: string; dateTo: string }) => {
    dispatch({ type: "SET_PERIOD_PRESET", preset });
    startTransition(async () => {
      const s = await getGymStats({ from: range.dateFrom, to: range.dateTo });
      dispatch({ type: "SET_STATS", stats: s });
      const ws = await getWorkouts(20, range.dateFrom, range.dateTo);
      dispatch({ type: "SET_WORKOUTS", workouts: ws as GymWorkout[] });
    });
  }, []);

  usePageShortcuts(
    useMemo(() => ({
      n: () => { if (!activeWorkout) handlers.handleStartWorkout(); },
      Escape: () => {
        if (exercisePickerOpen) dispatch({ type: "SET_EXERCISE_PICKER_OPEN", open: false });
        else if (showGarminLink) dispatch({ type: "CLOSE_GARMIN_LINK" });
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [activeWorkout, exercisePickerOpen, showGarminLink]),
  );

  const recommendation = getWorkoutRecommendation(initialMuscleRecovery);

  const recommendedDay = useMemo(() => {
    if (!recommendation || programs.length === 0) return null;
    const recMuscles = new Set(recommendation.split.muscles.map((m) => m.toLowerCase()));
    let bestDay: { dayId: number; dayName: string; focus: string | null; programName: string; overlap: number } | null = null;
    for (const prog of programs) {
      for (const day of prog.days) {
        if (day.focus) {
          const dayMuscles = day.focus.split(",").map((s) => s.trim().toLowerCase());
          const overlap = dayMuscles.filter((m) => recMuscles.has(m)).length;
          if (overlap > 0 && (!bestDay || overlap > bestDay.overlap)) {
            bestDay = { dayId: day.id, dayName: day.dayName, focus: day.focus, programName: prog.name, overlap };
          }
        }
      }
    }
    return bestDay;
  }, [recommendation, programs]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="sr-only">{t("title")}</h1>
        <PeriodSelector
          value={periodPreset}
          onChange={handlePeriodChange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(from, to) => dispatch({ type: "SET_CUSTOM_RANGE", from, to })}
        />
      </div>

      {/* Quick Stats */}
      <ErrorBoundary moduleName="Gym Stats">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <Card size="sm" className="metric-card stagger-1">
            <CardContent>
              <div className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 truncate">{t("workouts")}</div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight">{stats.totalWorkouts}</div>
            </CardContent>
          </Card>
          <Card size="sm" className="metric-card stagger-2">
            <CardContent>
              <div className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 truncate">{t("total_volume")}</div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight">{stats.totalVolume ? `${(stats.totalVolume / 1000).toFixed(1)}t` : "\u2014"}</div>
            </CardContent>
          </Card>
          <Card size="sm" className="metric-card stagger-3">
            <CardContent>
              <div className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 truncate">Avg / wk</div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight">{stats.sessionsPerWeek.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/wk</span></div>
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>

      {/* Muscle Recovery */}
      <ErrorBoundary moduleName="Muscle Recovery">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("muscle_recovery")}</CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> {t("recovery_training")}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> {t("recovery_recovering")}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> {t("recovery_almost_ready")}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> {t("recovery_recovered")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <RecoveryChips muscleGroups={initialMuscleRecovery} />
          </CardContent>
        </Card>
      </ErrorBoundary>

      <div className="space-y-4">
        {!activeWorkout && (
          <ErrorBoundary moduleName="Workout Recommendation">
            <WorkoutRecommendation
              recommendation={recommendation}
              recommendedDayId={recommendedDay?.dayId ?? null}
              recommendedDayName={recommendedDay?.dayName ?? null}
              recommendedDayFocus={recommendedDay?.focus ?? null}
              recommendedProgramName={recommendedDay?.programName ?? null}
              isPending={handlers.isPending}
              onStartRecommended={recommendedDay ? () => {
                startTransition(async () => {
                  await startWorkoutFromTemplate(recommendedDay.dayId, todayString());
                  await handlers.refreshActiveWorkout();
                  timer.reset();
                  timer.start();
                });
              } : undefined}
              onOpenDialog={() => dispatch({ type: "SET_START_DIALOG_OPEN", open: true })}
            />
          </ErrorBoundary>
        )}

        <ErrorBoundary moduleName="Workout Calendar">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("calendar")}</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkoutCalendar initialData={initialCalendarData} initialYear={initialCalendarYear} initialMonth={initialCalendarMonth} />
            </CardContent>
          </Card>
        </ErrorBoundary>

        {showGarminLink && justCompletedWorkoutId && (
          <GarminActivityLinker
            garminActivities={garminActivities}
            justCompletedWorkoutId={justCompletedWorkoutId}
            isPending={handlers.isPending}
            onLinkGarmin={handlers.handleLinkGarmin}
            onClose={() => dispatch({ type: "CLOSE_GARMIN_LINK" })}
          />
        )}

        <ErrorBoundary moduleName="Workout History">
          <Card>
            <CardHeader className="cursor-pointer select-none" onClick={() => dispatch({ type: "TOGGLE_HISTORY_OPEN" })}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronDownIcon className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                  <CardTitle className="text-sm">{t("workout_history")}</CardTitle>
                </div>
                <Badge variant="secondary">{workouts.length}</Badge>
              </div>
            </CardHeader>
            {historyOpen && (
              <CardContent className="pt-0">
                <WorkoutHistory
                  workouts={workouts}
                  exercises={exercises}
                  favoriteIds={favoriteIds}
                  expandedWorkoutId={expandedWorkoutId}
                  onToggleExpand={(id) => dispatch({ type: "SET_EXPANDED_WORKOUT_ID", id: expandedWorkoutId === id ? null : id })}
                  isPending={handlers.isPending}
                  editingWorkoutId={editingWorkoutId}
                  editWorkoutName={editWorkoutName}
                  editWorkoutDate={editWorkoutDate}
                  onStartEditWorkout={handlers.handleStartEditWorkout}
                  onEditWorkoutNameChange={(name) => dispatch({ type: "SET_EDIT_WORKOUT_NAME", name })}
                  onEditWorkoutDateChange={(date) => dispatch({ type: "SET_EDIT_WORKOUT_DATE", date })}
                  onSaveWorkout={handlers.handleSaveWorkout}
                  onCancelEditWorkout={() => dispatch({ type: "CANCEL_EDIT_WORKOUT" })}
                  editingSetId={editingSetId}
                  editWeight={editWeight}
                  editReps={editReps}
                  editIntensity={editIntensity}
                  onEditSet={handlers.handleEditSet}
                  onEditWeightChange={(weight) => dispatch({ type: "SET_EDIT_WEIGHT", weight })}
                  onEditRepsChange={(reps) => dispatch({ type: "SET_EDIT_REPS", reps })}
                  onEditIntensityChange={(intensity) => dispatch({ type: "SET_EDIT_INTENSITY", intensity })}
                  onSaveSet={handlers.handleSaveSet}
                  onCancelEditSet={() => dispatch({ type: "CANCEL_EDIT_SET" })}
                  onDeleteSet={handlers.handleDeleteSet}
                  onRemoveExercise={handlers.handleRemoveExerciseFromHistory}
                  onAddExerciseToWorkout={handlers.handleAddExerciseToHistoryWorkout}
                  onAddDefaultExerciseToWorkout={handlers.handleAddDefaultExerciseToHistory}
                  onAddSetToHistory={handlers.handleAddSetToHistory}
                  onDeleteWorkout={handlers.handleDeleteWorkout}
                />
              </CardContent>
            )}
          </Card>
        </ErrorBoundary>
      </div>

      {activeWorkout && (
        <ErrorBoundary moduleName="Active Workout">
          <ActiveWorkoutPanel
            activeWorkout={activeWorkout}
            exercises={exercises}
            favoriteIds={favoriteIds}
            isPending={handlers.isPending}
            timer={timer}
            exercisePickerOpen={exercisePickerOpen}
            onExercisePickerOpenChange={(open: boolean) => dispatch({ type: "SET_EXERCISE_PICKER_OPEN", open })}
            exerciseSearch={exerciseSearch}
            onExerciseSearchChange={(search: string) => dispatch({ type: "SET_EXERCISE_SEARCH", search })}
            exerciseMuscleFilter={exerciseMuscleFilter}
            onExerciseMuscleFilterChange={(filter: string) => dispatch({ type: "SET_EXERCISE_MUSCLE_FILTER", filter })}
            editingSetId={editingSetId}
            editWeight={editWeight}
            editReps={editReps}
            editIntensity={editIntensity}
            onEditSet={handlers.handleEditSet}
            onEditWeightChange={(weight: string) => dispatch({ type: "SET_EDIT_WEIGHT", weight })}
            onEditRepsChange={(reps: string) => dispatch({ type: "SET_EDIT_REPS", reps })}
            onEditIntensityChange={(intensity: string) => dispatch({ type: "SET_EDIT_INTENSITY", intensity })}
            onSaveSet={handlers.handleSaveSet}
            onCancelEditSet={() => dispatch({ type: "CANCEL_EDIT_SET" })}
            onDeleteSet={handlers.handleDeleteSet}
            newPRs={newPRs}
            onCompleteWorkout={handlers.handleCompleteWorkout}
            onAddExercise={handlers.handleAddExerciseToWorkout}
            onAddDefaultExercise={handlers.handleAddDefaultExerciseToActive}
            onRemoveExercise={handlers.handleRemoveExercise}
            onAddSet={handlers.handleAddSet}
            onCopyPreviousSet={handlers.handleCopyPreviousSet}
            onLoadPrevious={handlers.handleLoadPrevious}
            onReorderExercises={handlers.handleReorderExercises}
          />
        </ErrorBoundary>
      )}

      {!activeWorkout && (
        <StartWorkoutDialog
          programs={programs}
          recommendation={recommendation}
          isPending={handlers.isPending}
          open={startDialogOpen}
          onOpenChange={(open: boolean) => dispatch({ type: "SET_START_DIALOG_OPEN", open })}
          onStartFreeWorkout={() => {
            startTransition(async () => {
              await createWorkout({ date: todayString() });
              await handlers.refreshActiveWorkout();
              timer.reset();
              timer.start();
            });
          }}
          onStartFromTemplate={(dayId) => {
            startTransition(async () => {
              await startWorkoutFromTemplate(dayId, todayString());
              await handlers.refreshActiveWorkout();
              timer.reset();
              timer.start();
            });
          }}
        />
      )}
    </div>
  );
}

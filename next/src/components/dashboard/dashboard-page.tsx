"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  WalletIcon,
  DumbbellIcon,
  SmileIcon,
  ActivityIcon,
  ZapIcon,
  BanknoteIcon,
  HeartPulseIcon,
  ScaleIcon,
  SmartphoneIcon,
} from "lucide-react";
import { PeriodSelector, type PeriodPreset, getDateRange } from "@/components/ui/period-selector";
import { Card, CardContent } from "@/components/ui/card";
import { TrainingReadinessChart } from "./training-readiness-chart";
import {
  getDashboardKPIs,
  getMonthlyTrends,
  getLifestyleCorrelations,
  getMonthlyDeepDive,
  getGarminHealthTrends,
  getMoodTimeline,
  getFullMoodTimeline,
  getAllDailyLogs,
  getHRVTrend,
  getExerciseProgress,
  getWeeklyMuscleVolume,
  getExtendedCorrelations,
  type DashboardKPIs,
  type MonthlyTrend,
  type RecentActivityItem,
  type CorrelationPoint,
  type MonthlyDeepDive,
  type GarminHealthTrends,
  type MoodTimelinePoint,
  type HRVTrendPoint,
  type ExerciseProgressPoint,
  type ExerciseOption,
  type WeeklyMuscleVolumeRow,
  type ExtendedCorrelations,
  type ScreenTimeData,
  type KidsTimeData,
  getScreenTimeData,
  getKidsTimeData,
} from "@/actions/dashboard";

import { ErrorBoundary } from "@/components/shared/error-boundary";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { usePageShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useChartColors } from "@/hooks/use-chart-colors";
import { KpiGrid, type KpiCardProps } from "./kpi-grid";
import { MoodTimeline } from "./mood-timeline";
import { GarminHealthCharts } from "./garmin-health-charts";
import { ExerciseProgressChart } from "./exercise-progress-chart";
import { IncomeExpensesChart } from "./income-expenses-chart";
import { PortfolioHistoryChart, type PortfolioHistoryPoint } from "./portfolio-history-chart";
import { PortfolioSummaryCard } from "./portfolio-summary-card";
import { DailyLogsCard } from "./daily-logs-card";
import { ExpenseBreakdownCard } from "./expense-breakdown-card";
import { ScreenTimeWidget } from "./screen-time-widget";
import { KidsTimeWidget } from "./kids-time-widget";
import { CorrelationMatrixChart } from "./correlation-matrix-chart";
import {
  KpiGridSkeleton,
  MoodTimelineSkeleton,
  GarminHealthSkeleton,
  ExpenseBreakdownSkeleton,
  ExerciseProgressSkeleton,
  IncomeExpensesSkeleton,
} from "./dashboard-skeletons";
import { useDeferredDashboardData } from "./dashboard-context";
import { MONTH_LABELS, pctChange, type DashboardPageProps } from "./dashboard-types";

export function DashboardPage({
  initialKpis,
  initialTrends,
  initialActivity,
  initialCorrelations,
  initialDeepDive,
  initialGarminHealth,
  initialMoodTimeline,
  initialHRVTrend,
  initialExerciseList,
  initialWeeklyMuscleVolume,
  initialExtendedCorrelations,
  activeTab = "life",
}: DashboardPageProps) {
  const t = useTranslations("dashboard");
  const tPeriod = useTranslations("period");
  const tCommon = useTranslations("common");
  const tGym = useTranslations("gym");

  /* ---- Theme-aware chart colors ---- */
  const { tooltipStyle } = useChartColors();

  /* ---- Deferred data from Suspense streaming ---- */
  const deferred = useDeferredDashboardData();

  const [period, setPeriod] = useState<PeriodPreset>("this_year");
  const [dashCustomFrom, setDashCustomFrom] = useState("");
  const [dashCustomTo, setDashCustomTo] = useState("");
  const [kpis, setKpis] = useState<DashboardKPIs>(initialKpis);
  const [trends, setTrends] = useState<MonthlyTrend[]>(initialTrends ?? []);
  const [correlations, setCorrelations] = useState<CorrelationPoint[]>(initialCorrelations ?? []);
  const [deepDive, setDeepDive] = useState<MonthlyDeepDive | null>(initialDeepDive ?? null);
  const [garminHealth, setGarminHealth] = useState<GarminHealthTrends | null>(initialGarminHealth ?? null);
  const [moodTimeline, setMoodTimeline] = useState<MoodTimelinePoint[]>(initialMoodTimeline ?? []);
  const [fullMoodData, setFullMoodData] = useState<MoodTimelinePoint[] | null>(null);
  const [fullChartOpen, setFullChartOpen] = useState(false);
  const [dailyLogsOpen, setDailyLogsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allDailyLogs, setAllDailyLogs] = useState<any[] | null>(null);
  const [hrvTrend, setHRVTrend] = useState<HRVTrendPoint[]>(initialHRVTrend ?? []);
  const [exerciseList, setExerciseList] = useState<ExerciseOption[]>(initialExerciseList ?? []);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(
    initialExerciseList && initialExerciseList.length > 0 ? initialExerciseList[0].id : null,
  );
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgressPoint[]>([]);
  const [weeklyMuscleVolume, setWeeklyMuscleVolume] = useState<WeeklyMuscleVolumeRow[]>(initialWeeklyMuscleVolume ?? []);
  const [extCorrelations, setExtCorrelations] = useState<ExtendedCorrelations | null>(initialExtendedCorrelations ?? null);
  const [screenTime, setScreenTime] = useState<ScreenTimeData | undefined>(undefined);
  const [kidsTime, setKidsTime] = useState<KidsTimeData | undefined>(undefined);
  const [capitalEur, setCapitalEur] = useState<number | null>(null);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  /** Tracks whether user changed period (disables deferred hydration) */
  const [periodChanged, setPeriodChanged] = useState(false);

  /* ---- Hydrate state from deferred data as it streams in ---- */
  useEffect(() => {
    if (periodChanged) return; // user changed period, ignore deferred data
    if (deferred.trends && trends.length === 0) setTrends(deferred.trends);
    if (deferred.correlations && correlations.length === 0) setCorrelations(deferred.correlations);
    if (deferred.deepDive && !deepDive) setDeepDive(deferred.deepDive);
    if (deferred.garminHealth && !garminHealth) setGarminHealth(deferred.garminHealth);
    if (deferred.moodTimeline && moodTimeline.length === 0) setMoodTimeline(deferred.moodTimeline);
    if (deferred.hrvTrend && hrvTrend.length === 0) setHRVTrend(deferred.hrvTrend);
    if (deferred.exerciseList && exerciseList.length === 0) {
      setExerciseList(deferred.exerciseList);
      if (deferred.exerciseList.length > 0 && selectedExerciseId === null) {
        setSelectedExerciseId(deferred.exerciseList[0].id);
      }
    }
    if (deferred.weeklyMuscleVolume && weeklyMuscleVolume.length === 0) setWeeklyMuscleVolume(deferred.weeklyMuscleVolume);
    if (deferred.extendedCorrelations && !extCorrelations) setExtCorrelations(deferred.extendedCorrelations);
    if (deferred.screenTime && !screenTime) setScreenTime(deferred.screenTime);
    if (deferred.kidsTime && !kidsTime) setKidsTime(deferred.kidsTime);
  }, [deferred, periodChanged]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: Escape → close full-screen chart dialog
  usePageShortcuts(
    useMemo(
      () => ({
        Escape: () => {
          if (fullChartOpen) setFullChartOpen(false);
          else if (dailyLogsOpen) setDailyLogsOpen(false);
        },
      }),
      [fullChartOpen, dailyLogsOpen],
    ),
  );

  useEffect(() => { setMounted(true); }, []);

  // Load capital via API to avoid server action during render
  useEffect(() => {
    fetch("/api/capital").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.capitalEur != null) setCapitalEur(data.capitalEur);
    }).catch(() => {});
  }, []);

  // Load exercise progress when selectedExerciseId is available
  useEffect(() => {
    if (selectedExerciseId !== null) {
      getExerciseProgress(selectedExerciseId, 180).then(setExerciseProgress);
    }
  }, [selectedExerciseId]);

  const handlePeriodChange = useCallback(
    (preset: PeriodPreset, dateRange: { dateFrom: string; dateTo: string }) => {
      setPeriod(preset);
      setPeriodChanged(true);
      startTransition(async () => {
        try {
          const range = { from: dateRange.dateFrom, to: dateRange.dateTo };
          // Calculate days from today back to range start (not just range width).
          // Empty range (preset "all") → fall back to 365d window.
          const rangeStart = range.from ? new Date(range.from).getTime() : NaN;
          const daysFromStart = Number.isFinite(rangeStart)
            ? Math.max(7, Math.ceil((Date.now() - rangeStart) / 86400000))
            : 365;
          const weeks = Math.max(1, Math.ceil(daysFromStart / 7));
          const rangeYear = range.from
            ? new Date(range.from).getFullYear()
            : new Date().getFullYear();
          const [newKpis, newTrends, newCorrelations, newDeepDive, newGarminHealth, newMoodTimeline, newHRVTrend, newWeeklyMuscle, newExtCorr, newScreenTime, newKidsTime] =
            await Promise.all([
              getDashboardKPIs({ ...range, preset }),
              getMonthlyTrends(rangeYear),
              getLifestyleCorrelations(range),
              getMonthlyDeepDive(range),
              getGarminHealthTrends(daysFromStart),
              getMoodTimeline(range),
              getHRVTrend(daysFromStart),
              getWeeklyMuscleVolume(weeks),
              getExtendedCorrelations(range),
              getScreenTimeData(daysFromStart),
              getKidsTimeData(daysFromStart),
            ]);
          setKpis(newKpis);
          setTrends(newTrends);
          setCorrelations(newCorrelations);
          setDeepDive(newDeepDive);
          setGarminHealth(newGarminHealth);
          setMoodTimeline(newMoodTimeline);
          setHRVTrend(newHRVTrend);
          setWeeklyMuscleVolume(newWeeklyMuscle);
          setExtCorrelations(newExtCorr);
          setScreenTime(newScreenTime);
          setKidsTime(newKidsTime);
        } catch (e) {
          console.error("[Dashboard] Period change error:", e);
        }
      });
    },
    [startTransition],
  );

  const handleExerciseChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const id = parseInt(value, 10);
      if (isNaN(id)) return;
      setSelectedExerciseId(id);
      startTransition(async () => {
        const progress = await getExerciseProgress(id, 180);
        setExerciseProgress(progress);
      });
    },
    [startTransition],
  );

  const handleDailyLogsToggle = useCallback(() => {
    if (!dailyLogsOpen && !allDailyLogs) {
      startTransition(async () => {
        const logs = await getAllDailyLogs();
        setAllDailyLogs(logs);
        setDailyLogsOpen(true);
      });
    } else {
      setDailyLogsOpen(!dailyLogsOpen);
    }
  }, [dailyLogsOpen, allDailyLogs, startTransition]);

  const incomeExpensesData = trends.map((m) => ({
    name: MONTH_LABELS[m.month - 1],
    income: m.income,
    expenses: m.expenses,
    expensesByCategory: m.expensesByCategory,
  }));

  const prev = kpis.previousPeriod;

  const lifeCards: KpiCardProps[] = [
    { title: t("mood"), value: kpis.lifestyle.avgMood !== null ? `${kpis.lifestyle.avgMood}` : "\u2014", icon: <SmileIcon className="h-4 w-4" />, change: pctChange(kpis.lifestyle.avgMood, prev?.avgMood), improvementDirection: "up", distribution: kpis.lifestyle.moodDistribution },
    { title: t("sleep_quality"), value: `${kpis.health.avgSleepScore}`, icon: <ZapIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgSleepScore, prev?.avgSleepScore), improvementDirection: "up" },
    { title: t("steps"), value: `${kpis.health.avgSteps.toLocaleString("en")}`, icon: <ActivityIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgSteps, prev?.avgSteps), improvementDirection: "up" },
    { title: t("weight"), value: kpis.health.latestWeight !== null ? `${kpis.health.latestWeight.toFixed(1)} kg` : "\u2014", icon: <ScaleIcon className="h-4 w-4" />, change: pctChange(kpis.health.latestWeight, prev?.latestWeight), improvementDirection: "down" },
    { title: t("resting_hr"), value: kpis.health.avgRestingHr > 0 ? `${kpis.health.avgRestingHr} bpm` : "\u2014", icon: <HeartPulseIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgRestingHr, prev?.avgRestingHr), improvementDirection: "down" },
    { title: t("sex_bj"), value: `${kpis.lifestyle.totalSex + kpis.lifestyle.totalBj}`, subtitle: `${kpis.lifestyle.totalSex}s / ${kpis.lifestyle.totalBj}b`, icon: <HeartPulseIcon className="h-4 w-4" />, change: pctChange(kpis.lifestyle.totalSex + kpis.lifestyle.totalBj, (prev?.totalSex ?? 0) + (prev?.totalBj ?? 0)), improvementDirection: "up" },
    { title: t("body_battery"), value: kpis.health.avgBodyBattery ? `${kpis.health.avgBodyBattery}%` : "\u2014", icon: <ZapIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgBodyBattery, prev?.avgBodyBattery), improvementDirection: "up" },
    ...(screenTime && screenTime.avgDailyMinutes > 0 ? [{ title: t("screen_time"), value: `${Math.floor(screenTime.avgDailyMinutes / 60)}h ${screenTime.avgDailyMinutes % 60}m`, icon: <SmartphoneIcon className="h-4 w-4" />, improvementDirection: "down" as const }] : []),
  ];

  const financeCards: KpiCardProps[] = [
    ...(capitalEur !== null ? [{ title: t("capital") || "Capital", value: `EUR ${capitalEur.toLocaleString("en")}`, icon: <WalletIcon className="h-4 w-4" /> }] : []),
    { title: `${t("income_vs_expense").split(" vs ")[0] ?? "Income"} / ${t("income_vs_expense").split(" vs ")[1] ?? "Expense"}`, value: `EUR ${kpis.finance.income.toLocaleString("en")}`, subtitle: `-EUR ${kpis.finance.expenses.toLocaleString("en")}`, icon: <BanknoteIcon className="h-4 w-4" /> },
    { title: t("savings_rate") || "Savings", value: `${kpis.finance.savingsRate}%`, icon: <WalletIcon className="h-4 w-4" /> },
  ];

  const trainingCards: KpiCardProps[] = [
    { title: t("gym"), value: `${kpis.fitness.gymSessions}`, subtitle: `${kpis.fitness.totalWorkoutMinutes} min`, icon: <DumbbellIcon className="h-4 w-4" />, change: pctChange(kpis.fitness.gymSessions, prev?.gymSessions), improvementDirection: "up" },
    { title: t("steps"), value: `${kpis.health.avgSteps.toLocaleString("en")}`, icon: <ActivityIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgSteps, prev?.avgSteps), improvementDirection: "up" },
    { title: t("resting_hr"), value: kpis.health.avgRestingHr > 0 ? `${kpis.health.avgRestingHr} bpm` : "\u2014", icon: <HeartPulseIcon className="h-4 w-4" />, change: pctChange(kpis.health.avgRestingHr, prev?.avgRestingHr), improvementDirection: "down" },
  ];

  const kpiCards = activeTab === "finance" ? financeCards : activeTab === "training" ? trainingCards : lifeCards;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header + Period Selector */}
      <div className="flex flex-col gap-3">
        <h1 className="sr-only">Dashboard</h1>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          customFrom={dashCustomFrom}
          customTo={dashCustomTo}
          onCustomChange={(f, t) => { setDashCustomFrom(f); setDashCustomTo(t); }}
        />
      </div>

      {/* KPI Cards */}
      <div aria-live="polite" aria-atomic="true">
      <ErrorBoundary moduleName="KPI Cards">
        {isPending ? <KpiGridSkeleton /> : <KpiGrid cards={kpiCards} />}
      </ErrorBoundary>
      </div>

      {/* === LIFE TAB === */}
      {activeTab === "life" && mounted && <div role="tabpanel" aria-label="Life" aria-live="polite">
      {/* Life Quality Timeline (mood + sex & BJ) */}
      <ErrorBoundary moduleName="Life Quality Timeline">
      {isPending || (!periodChanged && moodTimeline.length === 0 && !deferred.moodTimeline) ? <MoodTimelineSkeleton /> : (
      <MoodTimeline
        moodTimeline={moodTimeline}
        fullMoodData={fullMoodData}
        fullChartOpen={fullChartOpen}
        isPending={isPending}
        titleLabel={t("life_quality")}
        moodLevelLabel={t("mood_level")}
        noDataLabel={t("mood_no_data")}
        tooltipStyle={tooltipStyle}
        onOpenFullChart={() => {
          if (fullMoodData) {
            setFullChartOpen(true);
          } else {
            startTransition(async () => {
              const data = await getFullMoodTimeline();
              setFullMoodData(data);
              setFullChartOpen(true);
            });
          }
        }}
        onFullChartOpenChange={setFullChartOpen}
      />
      )}
      </ErrorBoundary>

      {/* Daily Logs Table (collapsible) */}
      <ErrorBoundary moduleName="Daily Logs">
      <DailyLogsCard
        isOpen={dailyLogsOpen}
        onToggle={handleDailyLogsToggle}
        logs={allDailyLogs}
        isPending={isPending}
      />
      </ErrorBoundary>

      {/* Screen Time Widget */}
      <ErrorBoundary moduleName="Screen Time">
      <ScreenTimeWidget
        data={screenTime}
        tooltipStyle={tooltipStyle}
        labels={{
          screenTime: t("screen_time"),
          dailyAvg: t("screen_time_daily_avg"),
          notifications: t("screen_time_notifications"),
          minutes: t("screen_time_minutes"),
          hours: t("screen_time_hours"),
          topApps: t("screen_time_top_apps"),
          noData: t("screen_time_no_data"),
          noDataHint: t("screen_time_no_data_hint"),
          daily: t("screen_time_daily"),
        }}
      />
      </ErrorBoundary>

      {/* Kids Time Widget */}
      <ErrorBoundary moduleName="Kids Time">
      <KidsTimeWidget
        data={kidsTime}
        tooltipStyle={tooltipStyle}
        labels={{
          title: t("kids_time"),
          dailyAvg: t("kids_time_daily_avg"),
          totalDays: t("kids_time_total_days"),
          noData: t("kids_time_no_data"),
          noDataHint: t("kids_time_no_data_hint"),
          minutes: t("kids_time_minutes"),
          target: t("kids_time_target"),
        }}
      />
      </ErrorBoundary>

      {/* Garmin Health Charts (body battery, sleep, steps, HRV, weight) */}
      <ErrorBoundary moduleName="Garmin Health">
      {isPending || !garminHealth ? <GarminHealthSkeleton /> : (
      <GarminHealthCharts
        garminHealth={garminHealth}
        hrvTrend={hrvTrend}
        tooltipStyle={tooltipStyle}
        labels={{
          bodyBattery: t("body_battery"),
          sleepQuality: t("sleep_quality"),
          deep: t("deep"),
          rem: t("rem"),
          light: t("light"),
          awake: t("awake"),
          score: t("score"),
          health: t("health"),
          steps: t("steps"),
          hrvTrend: t("hrv_trend"),
          hrvMs: t("hrv_ms"),
          weightBodyFat: t("weight_body_fat"),
          weightKg: t("weight_kg"),
          bodyFatPct: t("body_fat_pct"),
          stress: t("stress"),
          high: t("high"),
          low: t("low"),
          charged: t("charged"),
          max: t("max"),
          avg: t("avg"),
          fitnessAge: t("fitness_age"),
          trainingReadiness: t("training_readiness"),
          weeklyAvg: t("weekly_avg"),
          bmi: t("bmi"),
          activeMin: t("active_min"),
          stepsActiveMin: t("steps_active_min"),
          connectGarminHint: t("connect_garmin_hint"),
          sleepDuration: t("sleep_duration"),
          sleepNeed: t("sleep_need"),
          sleepConsistency: t("sleep_consistency"),
          bedtime: t("bedtime"),
          wakeTime: t("wake_time"),
          avgWeeklySleep: t("avg_weekly_sleep"),
          avgSleepNeed: t("avg_sleep_need"),
          calories: t("calories"),
          activeCalories: t("active_calories"),
          restingCalories: t("resting_calories"),
          sleepScore: t("sleep_score"),
          sleepTrend7d: t("sleep_trend_7d"),
        }}
      />
      )}
      </ErrorBoundary>

      {/* Lifestyle Correlations (screen time × kids × body battery × active min) */}
      <ErrorBoundary moduleName="Lifestyle Correlations">
      <CorrelationMatrixChart
        screenTime={screenTime}
        kidsTime={kidsTime}
        garminHealth={garminHealth}
        labels={{
          title: t("correlation_title"),
          subtitle: t("correlation_subtitle"),
          trendsHeading: t("correlation_trends_heading"),
          linksHeading: t("correlation_links_heading"),
          noData: t("correlation_no_data"),
          noDataHint: t("correlation_no_data_hint"),
          noLinks: t("correlation_no_links"),
          avg: t("correlation_avg"),
          relTogether: t("correlation_rel_together"),
          relOpposite: t("correlation_rel_opposite"),
          strengthStrong: t("correlation_strength_strong"),
          strengthModerate: t("correlation_strength_moderate"),
          strengthWeak: t("correlation_strength_weak"),
          unitH: t("correlation_unit_h"),
          unitMin: t("correlation_unit_min"),
          screen: t("screen_time"),
          kids: t("kids_time"),
          battery: t("body_battery"),
          active: t("active_min"),
        }}
      />
      </ErrorBoundary>

      </div>}

      {/* === FINANCE TAB === */}
      {activeTab === "finance" && mounted && <div role="tabpanel" aria-label="Finance" aria-live="polite">
      {/* Portfolio Summary (from Investments) */}
      <PortfolioSummaryCard onHistoryLoaded={setPortfolioHistory} />

      {/* Portfolio History Chart */}
      <ErrorBoundary moduleName="Portfolio History">
      <PortfolioHistoryChart
        data={portfolioHistory}
        tooltipStyle={tooltipStyle}
        labels={{
          title: t("portfolio_history"),
          capital: t("total_nav"),
          pnl: t("pnl"),
          invested: t("invested"),
        }}
      />
      </ErrorBoundary>

      {/* Expense Breakdown */}
      <ErrorBoundary moduleName={t("expense_breakdown")}>
      {isPending || !deepDive ? <ExpenseBreakdownSkeleton /> : (
        <ExpenseBreakdownCard deepDive={deepDive} />
      )}
      </ErrorBoundary>

      {/* Income vs Expenses Chart */}
      <ErrorBoundary moduleName="Income vs Expenses">
      {isPending || (!periodChanged && trends.length === 0 && !deferred.trends) ? <IncomeExpensesSkeleton /> : (
      <IncomeExpensesChart
        chartData={incomeExpensesData}
        titleLabel={t("income_vs_expense")}
        tooltipStyle={tooltipStyle}
        incomeLabel={t("income_chart_label")}
        expensesLabel={t("expenses_chart_label")}
      />
      )}
      </ErrorBoundary>
      </div>}

      {/* === TRAINING TAB === */}
      {activeTab === "training" && mounted && <div role="tabpanel" aria-label="Training" aria-live="polite">
      {/* Exercise Progress + Weekly Muscle Volume */}
      <ErrorBoundary moduleName="Exercise Progress">
      {isPending || (!periodChanged && exerciseList.length === 0 && !deferred.exerciseList) ? <ExerciseProgressSkeleton /> : (
      <ExerciseProgressChart
        exerciseList={exerciseList}
        selectedExerciseId={selectedExerciseId}
        exerciseProgress={exerciseProgress}
        weeklyMuscleVolume={weeklyMuscleVolume}
        tooltipStyle={tooltipStyle}
        onExerciseChange={handleExerciseChange}
        labels={{
          exerciseProgress: tGym("exercise_progress"),
          selectExercise: tGym("select_exercise"),
          noDataExercise: tGym("no_data_exercise"),
          maxWeight: tGym("max_weight"),
          est1rm: tGym("est_1rm"),
          volume: t("volume"),
          weeklyMuscleVolume: tGym("weekly_muscle_volume"),
          muscleGroupLabel: (key: string) => {
            // DB stores lowercase ("chest"), i18n has capitalized ("Chest")
            const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
            return tGym(`muscle_groups.${capitalized}`) || tGym(`muscle_groups.${key}`) || key;
          },
        }}
      />
      )}
      </ErrorBoundary>

      {/* Training Readiness from Garmin */}
      {garminHealth && <TrainingReadinessChart garminHealth={garminHealth} tooltipStyle={tooltipStyle} />}

      {/* AI Insights for Gym & Exercises */}
      <InsightsPanel page="gym" />
      <InsightsPanel page="exercises" />

      </div>}
    </div>
  );
}

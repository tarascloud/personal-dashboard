import type {
  DashboardKPIs,
  MonthlyTrend,
  RecentActivityItem,
  CorrelationPoint,
  MonthlyDeepDive,
  GarminHealthTrends,
  MoodTimelinePoint,
  HRVTrendPoint,
  ExerciseOption,
  WeeklyMuscleVolumeRow,
  ExtendedCorrelations,
} from "@/actions/dashboard";

export interface DashboardPageProps {
  initialKpis: DashboardKPIs;
  initialPeriod: { from: string; to: string };
  initialTrends?: MonthlyTrend[];
  initialActivity?: RecentActivityItem[];
  initialCorrelations?: CorrelationPoint[];
  initialDeepDive?: MonthlyDeepDive;
  initialGarminHealth?: GarminHealthTrends;
  initialMoodTimeline?: MoodTimelinePoint[];
  initialHRVTrend?: HRVTrendPoint[];
  initialExerciseList?: ExerciseOption[];
  initialWeeklyMuscleVolume?: WeeklyMuscleVolumeRow[];
  initialExtendedCorrelations?: ExtendedCorrelations;
  activeTab?: "life" | "finance" | "training";
  [key: string]: unknown;
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function pctChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (current == null || previous == null || previous === 0) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { pct: 0, direction: "flat" };
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

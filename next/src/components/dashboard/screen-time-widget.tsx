"use client";

import { SmartphoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ScreenTimeData } from "@/actions/dashboard";
import { ScreenTimeDailyChart } from "./screen-time-daily-chart";
import { ScreenTimeCategories } from "./screen-time-categories";
import { ScreenTimeApps } from "./screen-time-apps";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ScreenTimeWidgetProps {
  data: ScreenTimeData | undefined;
  tooltipStyle: React.CSSProperties;
  labels: {
    screenTime: string;
    dailyAvg: string;
    pickups: string;
    notifications: string;
    minutes: string;
    hours: string;
    topApps: string;
    categories: string;
    noData: string;
    noDataHint: string;
    daily: string;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ScreenTimeWidget({ data, tooltipStyle, labels }: ScreenTimeWidgetProps) {
  if (!data || data.days.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <SmartphoneIcon className="size-4" />
            {labels.screenTime}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={SmartphoneIcon}
            title={labels.noData}
            description={labels.noDataHint}
            compact
          />
        </CardContent>
      </Card>
    );
  }

  // Aggregate latest day's categories for PieChart
  const latestDay = data.days[data.days.length - 1];
  const allApps = latestDay?.topApps ?? [];

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SmartphoneIcon className="size-4" />
          {labels.screenTime}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <KpiMini
            label={labels.dailyAvg}
            value={formatDuration(data.avgDailyMinutes)}
          />
          <KpiMini
            label={labels.pickups}
            value={String(data.avgPickups)}
          />
          <KpiMini
            label={labels.notifications}
            value={String(data.avgNotifications)}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Daily bar chart */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.daily}</p>
            <ScreenTimeDailyChart
              days={data.days}
              tooltipStyle={tooltipStyle}
              minutesLabel={labels.minutes}
              hoursLabel={labels.hours}
            />
          </div>

          {/* Category donut */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.categories}</p>
            <ScreenTimeCategories
              categories={latestDay?.categories ?? []}
              tooltipStyle={tooltipStyle}
              minutesLabel={labels.minutes}
            />
          </div>
        </div>

        {/* Top apps */}
        {allApps.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.topApps}</p>
            <ScreenTimeApps apps={allApps} totalMinutes={latestDay?.totalMinutes ?? 1} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KPI mini card                                                       */
/* ------------------------------------------------------------------ */

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

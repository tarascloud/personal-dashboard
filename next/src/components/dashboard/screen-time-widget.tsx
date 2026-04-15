"use client";

import { SmartphoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ScreenTimeData } from "@/actions/dashboard";
import { ScreenTimeDailyChart } from "./screen-time-daily-chart";
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
    notifications: string;
    minutes: string;
    hours: string;
    topApps: string;
    noData: string;
    noDataHint: string;
    daily: string;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatDuration(totalMinutes: number): string {
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

  // Aggregate top apps across all days in the period
  const appTotals = new Map<string, number>();
  for (const day of data.days) {
    for (const app of day.topApps ?? []) {
      appTotals.set(app.name, (appTotals.get(app.name) ?? 0) + app.minutes);
    }
  }
  const totalMinutesAll = data.days.reduce((s, d) => s + d.totalMinutes, 0);
  const allApps = [...appTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, minutes]) => ({ name, minutes }));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SmartphoneIcon className="size-4" />
          {labels.screenTime}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily bar chart — full width */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.daily}</p>
          <ScreenTimeDailyChart
            days={data.days}
            tooltipStyle={tooltipStyle}
            minutesLabel={labels.minutes}
            hoursLabel={labels.hours}
          />
        </div>

        {/* Top apps + KPIs side by side */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          {allApps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.topApps}</p>
              <ScreenTimeApps apps={allApps} totalMinutes={totalMinutesAll || 1} />
            </div>
          )}
          <div className="flex flex-col gap-2 md:min-w-[120px]">
            <KpiMini
              label={labels.dailyAvg}
              value={formatDuration(data.avgDailyMinutes)}
            />
            <KpiMini
              label={labels.notifications}
              value={String(data.avgNotifications)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KPI mini card                                                       */
/* ------------------------------------------------------------------ */

export function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

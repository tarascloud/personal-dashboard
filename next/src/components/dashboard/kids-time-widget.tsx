"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { BabyIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useChartColors } from "@/hooks/use-chart-colors";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { KidsTimeData } from "@/actions/dashboard";
import { formatDuration, KpiMini } from "./screen-time-widget";

export interface KidsTimeWidgetProps {
  data: KidsTimeData | undefined;
  tooltipStyle: React.CSSProperties;
  labels: {
    title: string;
    dailyAvg: string;
    totalDays: string;
    noData: string;
    noDataHint: string;
    minutes: string;
    target: string;
  };
}

const TARGET_MINUTES = 180;

export function KidsTimeWidget({ data, tooltipStyle, labels }: KidsTimeWidgetProps) {
  const { colors } = useChartColors();

  if (!data || data.days.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BabyIcon className="size-4" />
            {labels.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={BabyIcon}
            title={labels.noData}
            description={labels.noDataHint}
            compact
          />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.days.map((d) => ({
    date: d.date.slice(5),
    minutes: d.minutes,
  }));

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BabyIcon className="size-4" />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
            />
            <ChartTooltip
              formatter={(value) => {
                const v = Number(value ?? 0);
                return [formatDuration(v), labels.minutes];
              }}
              labelFormatter={(label) => String(label)}
            />
            <ReferenceLine
              y={TARGET_MINUTES}
              stroke="hsl(var(--chart-2))"
              strokeDasharray="6 3"
              label={{ value: labels.target, position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Bar
              dataKey="minutes"
              fill={colors.income ?? "hsl(var(--chart-3))"}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>

        <div className="flex gap-3">
          <KpiMini label={labels.dailyAvg} value={formatDuration(data.avgDailyMinutes)} />
          <KpiMini label={labels.totalDays} value={String(data.totalDays)} />
        </div>
      </CardContent>
    </Card>
  );
}

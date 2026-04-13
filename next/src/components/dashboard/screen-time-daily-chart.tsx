"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-colors";
import type { ScreenTimeDayPoint } from "@/actions/dashboard";

interface ScreenTimeDailyChartProps {
  days: ScreenTimeDayPoint[];
  tooltipStyle: React.CSSProperties;
  minutesLabel: string;
  hoursLabel: string;
}

export function ScreenTimeDailyChart({
  days,
  tooltipStyle,
  minutesLabel,
  hoursLabel,
}: ScreenTimeDailyChartProps) {
  const { colors } = useChartColors();

  const chartData = days.map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    totalMinutes: d.totalMinutes,
    hours: +(d.totalMinutes / 60).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            const v = Number(value ?? 0);
            return [`${Math.floor(v / 60)}h ${v % 60}m`, minutesLabel];
          }}
          labelFormatter={(label) => String(label)}
        />
        <Bar
          dataKey="totalMinutes"
          fill={colors.income ?? "hsl(var(--chart-1))"}
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

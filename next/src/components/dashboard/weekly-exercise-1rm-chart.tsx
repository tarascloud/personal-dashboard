"use client";

import { TrendingUpIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { WeeklyExercise1RMData } from "@/actions/dashboard";

// Categorical palette for up to 12 exercise lines (distinct hues, theme-neutral).
const PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#ec4899",
  "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#eab308", "#64748b",
];

export function WeeklyExercise1RMChart({ data }: { data: WeeklyExercise1RMData }) {
  const t = useTranslations("gym");

  if (data.exercises.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUpIcon className="size-4 text-muted-foreground" />
          {t("weekly_exercise_1rm")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 sm:h-[340px]">
          <figure role="img" style={{ height: "100%" }} aria-label={t("weekly_exercise_1rm")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeks} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis className="text-xs" width={44} unit={` ${t("kg")}`} />
                <ChartTooltip allowEscapeViewBox={{ x: true }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data.exercises.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name={name}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </figure>
        </div>
      </CardContent>
    </Card>
  );
}

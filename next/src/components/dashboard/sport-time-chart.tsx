"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useChartColors } from "@/hooks/use-chart-colors";
import type { SportTimeRow } from "@/actions/dashboard";

/** Turn a raw Garmin activity_type into a readable label. */
const SPORT_LABEL_OVERRIDES: Record<string, string> = {
  strength_training: "Strength",
  lap_swimming: "Lap swimming",
  stand_up_paddleboarding_v2: "SUP",
  resort_snowboarding: "Snowboarding",
};

function humanizeSport(activityType: string): string {
  if (SPORT_LABEL_OVERRIDES[activityType]) return SPORT_LABEL_OVERRIDES[activityType];
  const cleaned = activityType.replace(/_v2$/, "").replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface SportTimeChartProps {
  sportTime: SportTimeRow[];
  tooltipStyle: React.CSSProperties;
}

export function SportTimeChart({ sportTime, tooltipStyle }: SportTimeChartProps) {
  const t = useTranslations("dashboard");
  const { colors: CC } = useChartColors();

  const data = sportTime.map((r) => ({
    sport: humanizeSport(r.sport),
    hours: r.hours,
    sessions: r.sessions,
  }));

  if (data.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">{t("sport_time")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: Math.max(176, data.length * 28 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" className="text-xs" tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="sport"
                width={120}
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                formatter={(value, _name, item) => {
                  const sessions = (item?.payload as { sessions?: number } | undefined)?.sessions ?? 0;
                  return [
                    `${value} ${t("sport_time_hours")} · ${sessions} ${t("sport_time_sessions")}`,
                    t("sport_time_hours"),
                  ];
                }}
              />
              <Bar
                dataKey="hours"
                name={t("sport_time_hours")}
                fill={CC.accent}
                radius={[0, 2, 2, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

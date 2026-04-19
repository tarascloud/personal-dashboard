"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import type { GarminHealthTrends } from "@/actions/dashboard";

interface TrainingReadinessChartProps {
  garminHealth: GarminHealthTrends;
  tooltipStyle: React.CSSProperties;
}

export function TrainingReadinessChart({ garminHealth, tooltipStyle }: TrainingReadinessChartProps) {
  const t = useTranslations("dashboard");

  const data = garminHealth.daily
    .filter((d) => d.trainingReadiness != null)
    .map((d) => ({ date: d.date.slice(5), readiness: d.trainingReadiness }));

  if (data.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">{t("training_readiness")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-44 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <ChartTooltip />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Bar dataKey="readiness" name={t("training_readiness")} radius={[2, 2, 0, 0]}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.readiness != null && d.readiness >= 70
                        ? "#22c55e"
                        : d.readiness != null && d.readiness >= 50
                        ? "#f59e0b"
                        : "#ef4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

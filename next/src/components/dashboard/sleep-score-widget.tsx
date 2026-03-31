"use client";

import { MoonIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import type { GarminSleepPoint } from "@/actions/dashboard";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sleepScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

function sleepScoreBg(score: number | null): string {
  if (score == null) return "bg-muted/30";
  if (score >= 80) return "bg-green-500/10";
  if (score >= 60) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function sleepScoreLabel(score: number | null): string {
  if (score == null) return "—";
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

function formatPct(part: number | null, total: number | null): string {
  if (part == null || total == null || total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function formatDuration(hours: number | null): string {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface SleepScoreWidgetLabels {
  title: string;
  deep: string;
  rem: string;
  duration: string;
  score: string;
  trend7d: string;
  noData: string;
}

export interface SleepScoreWidgetProps {
  sleep: GarminSleepPoint[];
  tooltipStyle: React.CSSProperties;
  labels: SleepScoreWidgetLabels;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SleepScoreWidget({ sleep, tooltipStyle, labels }: SleepScoreWidgetProps) {
  // Latest entry with sleep score
  const latest = [...sleep].reverse().find((s) => s.sleepScore != null) ?? sleep[sleep.length - 1] ?? null;

  // 7-day trend data (last 7 entries that have a score)
  const trend7 = sleep
    .filter((s) => s.sleepScore != null)
    .slice(-7)
    .map((s) => ({ date: s.date.slice(5), score: s.sleepScore }));

  const score = latest?.sleepScore ?? null;
  const duration = latest?.durationHours ?? null;
  const deep = latest?.deepHours ?? null;
  const rem = latest?.remHours ?? null;

  // Sparkline color based on latest score
  const sparkColor = score == null ? "#94a3b8" : score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <Card className={`${sleepScoreBg(score)} border-none shadow-sm`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <MoonIcon className="h-4 w-4" />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {latest == null ? (
          <p className="text-sm text-muted-foreground">{labels.noData}</p>
        ) : (
          <div className="flex items-start justify-between gap-4">
            {/* Left: score + label */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className={`text-4xl font-bold tabular-nums leading-none ${sleepScoreColor(score)}`}>
                {score ?? "—"}
              </span>
              <span className={`text-xs font-medium ${sleepScoreColor(score)}`}>
                {sleepScoreLabel(score)}
              </span>

              {/* Metrics row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{formatDuration(duration)}</span>{" "}
                  {labels.duration}
                </span>
                <span>
                  <span className="font-medium text-foreground">{formatPct(deep, duration)}</span>{" "}
                  {labels.deep}
                </span>
                <span>
                  <span className="font-medium text-foreground">{formatPct(rem, duration)}</span>{" "}
                  {labels.rem}
                </span>
              </div>
            </div>

            {/* Right: 7-day sparkline */}
            {trend7.length > 1 && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">{labels.trend7d}</span>
                <div className="w-28 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend7}>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${value}`, labels.score]}
                        labelFormatter={(label) => label}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={sparkColor}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Min / max annotation */}
                {trend7.length >= 2 && (() => {
                  const scores = trend7.map((d) => d.score as number);
                  const min = Math.min(...scores);
                  const max = Math.max(...scores);
                  return (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {min} – {max}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

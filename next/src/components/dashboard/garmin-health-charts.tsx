"use client";

import {
  ActivityIcon,
  HeartPulseIcon,
  MoonIcon,
  ScaleIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
  ReferenceLine,
  Cell,
} from "recharts";
import type { GarminHealthTrends, HRVTrendPoint } from "@/actions/dashboard";
import { useChartColors } from "@/hooks/use-chart-colors";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { SleepScoreWidget } from "./sleep-score-widget";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface GarminHealthChartsProps {
  garminHealth: GarminHealthTrends;
  hrvTrend: HRVTrendPoint[];
  tooltipStyle: React.CSSProperties;
  labels: {
    bodyBattery: string;
    sleepQuality: string;
    deep: string;
    rem: string;
    light: string;
    awake: string;
    score: string;
    health: string;
    steps: string;
    hrvTrend: string;
    hrvMs: string;
    weightBodyFat: string;
    weightKg: string;
    bodyFatPct: string;
    stress: string;
    high: string;
    low: string;
    charged: string;
    max: string;
    avg: string;
    fitnessAge: string;
    trainingReadiness: string;
    weeklyAvg: string;
    bmi: string;
    activeMin: string;
    stepsActiveMin: string;
    connectGarminHint: string;
    sleepDuration: string;
    sleepNeed: string;
    sleepConsistency: string;
    bedtime: string;
    wakeTime: string;
    avgWeeklySleep: string;
    avgSleepNeed: string;
    calories: string;
    activeCalories: string;
    restingCalories: string;
    sleepScore: string;
    sleepTrend7d: string;
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function GarminHealthCharts({
  garminHealth,
  hrvTrend,
  tooltipStyle,
  labels,
}: GarminHealthChartsProps) {
  const { colors: CC } = useChartColors();
  const hasData = garminHealth.daily.length > 0 || garminHealth.weight.length > 0 || hrvTrend.length > 0;
  if (!hasData) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={HeartPulseIcon}
            title={labels.connectGarminHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Sleep Score Widget — compact summary card */}
      {garminHealth.sleep.length > 0 && (
        <SleepScoreWidget
          sleep={garminHealth.sleep}
          tooltipStyle={tooltipStyle}
          labels={{
            title: labels.sleepQuality,
            deep: labels.deep,
            rem: labels.rem,
            duration: labels.sleepDuration,
            score: labels.score,
            trend7d: labels.sleepTrend7d,
            noData: labels.connectGarminHint,
          }}
        />
      )}

      {/* Body Battery & Sleep Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Body Battery Trend */}
        {garminHealth.daily.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.bodyBattery}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44 sm:h-64">
                <figure role="img" style={{ height: "100%" }} aria-label="Графік Body Battery">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={garminHealth.daily.map((d) => ({
                    date: d.date.slice(5),
                    high: d.bodyBatteryHigh,
                    low: d.bodyBatteryLow,
                    charged: d.bodyBatteryHigh != null && d.bodyBatteryLow != null ? d.bodyBatteryHigh - d.bodyBatteryLow : null,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <ChartTooltip allowEscapeViewBox={{ x: true }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="high"
                      stroke={CC.positive}
                      fill={`${CC.positive}26`}
                      name={labels.high}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="low"
                      stroke={CC.negative}
                      fill={`${CC.negative}15`}
                      name={labels.low}
                      connectNulls
                    />
                    <Line type="monotone" dataKey="charged" stroke={CC.accent} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name={labels.charged} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                </figure>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sleep Quality Stacked Bar + Score Line */}
        {garminHealth.sleep.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MoonIcon className="h-4 w-4" />
                {labels.sleepQuality}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 sm:h-[300px]">
                <figure role="img" style={{ height: "100%" }} aria-label="Графік якості сну">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={garminHealth.sleep.map((s) => ({
                    date: s.date.slice(5),
                    deep: s.deepHours,
                    rem: s.remHours,
                    light: s.lightHours,
                    awake: s.awakeHours,
                    score: s.sleepScore,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="hours" className="text-xs" />
                    <YAxis yAxisId="score" orientation="right" domain={[0, 100]} className="text-xs" />
                    <ChartTooltip allowEscapeViewBox={{ x: true }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="hours" dataKey="deep" stackId="sleep" fill={CC.sleepDeep} name={labels.deep} />
                    <Bar yAxisId="hours" dataKey="rem" stackId="sleep" fill={CC.sleepRem} name={labels.rem} />
                    <Bar yAxisId="hours" dataKey="light" stackId="sleep" fill={CC.sleepLight} name={labels.light} />
                    <Bar yAxisId="hours" dataKey="awake" stackId="sleep" fill={CC.sleepAwake} name={labels.awake} />
                    <Line yAxisId="score" type="monotone" dataKey="score" stroke={CC.sleepScore} strokeWidth={2} dot={false} name={labels.score} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                </figure>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Sleep Duration (bar chart with sleep need reference line) */}
        {garminHealth.sleep.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MoonIcon className="h-4 w-4" />
                {labels.sleepDuration}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const sleepData = garminHealth.sleep.map((s) => ({
                  date: s.date.slice(5),
                  duration: s.durationHours,
                }));
                const avgDuration = sleepData.reduce((sum, d) => sum + (d.duration ?? 0), 0) / sleepData.filter(d => d.duration != null).length;
                return (
                  <>
                    <div className="flex gap-6 text-sm text-muted-foreground mb-2">
                      <span>{labels.avgWeeklySleep}: <strong className="text-foreground">{Math.floor(avgDuration)}h {Math.round((avgDuration % 1) * 60)}m</strong></span>
                      <span>{labels.avgSleepNeed}: <strong className="text-foreground">8h 0m</strong></span>
                    </div>
                    <div className="h-48 sm:h-[300px]">
                      <figure role="img" style={{ height: "100%" }} aria-label="Sleep Duration">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sleepData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis domain={[0, 12]} className="text-xs" />
                          <ChartTooltip formatter={(value) => { const v = Number(value); return [`${Math.floor(v)}h ${Math.round((v % 1) * 60)}m`, labels.sleepDuration]; }} />
                          <ReferenceLine y={8} stroke={CC.sleepNeed} strokeDasharray="4 4" label={{ value: labels.sleepNeed, position: "right", fontSize: 10, fill: CC.sleepNeed }} />
                          <Bar dataKey="duration" name={labels.sleepDuration} radius={[2, 2, 0, 0]}>
                            {sleepData.map((entry, index) => (
                              <Cell key={index} fill={(entry.duration ?? 0) >= 8 ? CC.positive : CC.sleepDuration} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      </figure>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Sleep Consistency (bedtime → wake as range bars) */}
        {garminHealth.sleep.some(s => s.sleepStartHour != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MoonIcon className="h-4 w-4" />
                {labels.sleepConsistency}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 sm:h-[300px]">
                <figure role="img" style={{ height: "100%" }} aria-label="Sleep Consistency">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={garminHealth.sleep.map((s) => {
                    const bedtime = s.sleepStartHour != null ? (s.sleepStartHour < 12 ? s.sleepStartHour + 24 : s.sleepStartHour) : null;
                    const wake = s.sleepEndHour != null ? (s.sleepEndHour < 12 ? s.sleepEndHour + 24 : s.sleepEndHour) : null;
                    return { date: s.date.slice(5), range: bedtime != null && wake != null ? [Math.min(bedtime, wake), Math.max(bedtime, wake)] as [number, number] : null };
                  })}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis
                      domain={[20, 34]}
                      className="text-xs"
                      tickFormatter={(v: number) => {
                        const h = v >= 24 ? v - 24 : v;
                        return `${String(Math.floor(h)).padStart(2, "0")}:00`;
                      }}
                      ticks={[21, 23, 25, 27, 29, 31, 33]}
                    />
                    <ChartTooltip
                      formatter={(value: unknown) => {
                        if (!Array.isArray(value)) return [String(value), ""];
                        const fmt = (v: number) => {
                          const h = v >= 24 ? v - 24 : v;
                          const hours = Math.floor(h);
                          const mins = Math.round((h % 1) * 60);
                          return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
                        };
                        const bedtime = Math.min(value[0], value[1]);
                        const wake = Math.max(value[0], value[1]);
                        return [`${fmt(bedtime)} → ${fmt(wake)}`, labels.sleepConsistency];
                      }}
                    />
                    <Bar dataKey="range" fill={CC.sleepBedtime} name={labels.sleepConsistency} radius={[2, 2, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
                </figure>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stress Trend */}
        {garminHealth.daily.some(d => d.avgStress != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.stress}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44 sm:h-64">
                <figure role="img" style={{ height: "100%" }} aria-label="Графік стресу">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={garminHealth.daily.map((d) => ({
                    date: d.date.slice(5),
                    avg: d.avgStress,
                    max: d.maxStress,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <ChartTooltip allowEscapeViewBox={{ x: true }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="max" stroke="#f87171" fill="#f8717120" name={labels.max} connectNulls />
                    <Area type="monotone" dataKey="avg" stroke="#f59e0b" fill="#f59e0b20" name={labels.avg} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
                </figure>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Training Readiness */}
        {garminHealth.daily.some(d => d.trainingReadiness != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.trainingReadiness}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44 sm:h-64">
                <figure role="img" style={{ height: "100%" }} aria-label="Training Readiness">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={garminHealth.daily.filter(d => d.trainingReadiness != null).map((d) => ({
                    date: d.date.slice(5),
                    readiness: d.trainingReadiness,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <ChartTooltip />
                    <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Bar dataKey="readiness" name={labels.trainingReadiness} radius={[2, 2, 0, 0]}>
                      {garminHealth.daily.filter(d => d.trainingReadiness != null).map((d, i) => (
                        <Cell key={i} fill={d.trainingReadiness != null && d.trainingReadiness >= 70 ? "#22c55e" : d.trainingReadiness != null && d.trainingReadiness >= 50 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </figure>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Steps + Weight */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HRV Sleep Trend */}
          {hrvTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4" />
                  {labels.hrvTrend}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44 sm:h-64">
                  <figure role="img" style={{ height: "100%" }} aria-label="Графік HRV тренду">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={hrvTrend.map((d) => ({
                      date: d.date.slice(5),
                      lastNight: d.hrvLastNight,
                      weeklyAvg: d.hrvWeeklyAvg,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis className="text-xs" />
                      <ChartTooltip allowEscapeViewBox={{ x: true }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="lastNight" fill={`${CC.hrv}40`} stroke={CC.hrv} name={labels.hrvMs} />
                      <Line type="monotone" dataKey="weeklyAvg" stroke={CC.accent} strokeWidth={2} dot={false} name={labels.weeklyAvg} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                  </figure>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weight / BMI Trend */}
          {garminHealth.weight.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScaleIcon className="h-4 w-4" />
                  {labels.weightBodyFat}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44 sm:h-64">
                  <figure role="img" style={{ height: "100%" }} aria-label="Графік ваги та складу тіла">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={garminHealth.weight.map((w) => ({
                      date: w.date.slice(5),
                      weight: w.weight,
                      bmi: w.bmi,
                      bodyFat: w.bodyFatPct,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="kg" className="text-xs" />
                      <YAxis yAxisId="pct" orientation="right" className="text-xs" />
                      <ChartTooltip allowEscapeViewBox={{ x: true }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="kg" type="monotone" dataKey="weight" stroke={CC.weight} strokeWidth={2} dot={{ r: 3 }} name={labels.weightKg} connectNulls />
                      <Line yAxisId="pct" type="monotone" dataKey="bmi" stroke={CC.bmi} strokeWidth={1} strokeDasharray="4 4" dot={false} name={labels.bmi} connectNulls />
                      <Line yAxisId="pct" type="monotone" dataKey="bodyFat" stroke={CC.bodyFat} strokeWidth={2} dot={{ r: 3 }} name={labels.bodyFatPct} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                  </figure>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps + Active Minutes */}
          {garminHealth.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{labels.stepsActiveMin}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44 sm:h-64">
                  <figure role="img" style={{ height: "100%" }} aria-label="Графік кроків та активних хвилин">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={garminHealth.daily.map((d) => ({
                      date: d.date.slice(5),
                      steps: d.steps,
                      activeMin: d.intensityMinutes,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="steps" className="text-xs" />
                      <YAxis yAxisId="minutes" orientation="right" className="text-xs" />
                      <ChartTooltip allowEscapeViewBox={{ x: true }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="steps" type="monotone" dataKey="steps" stroke={CC.steps} strokeWidth={2} dot={false} name={labels.steps} connectNulls />
                      <Line yAxisId="minutes" type="monotone" dataKey="activeMin" stroke={CC.activeMin} strokeWidth={2} dot={false} name={labels.activeMin} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                  </figure>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calories (Active + Resting stacked bar) */}
          {garminHealth.daily.some(d => d.caloriesActive != null) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{labels.calories}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 sm:h-[300px]">
                  <figure role="img" style={{ height: "100%" }} aria-label="Calories">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={garminHealth.daily.map((d) => ({
                      date: d.date.slice(5),
                      active: d.caloriesActive,
                      resting: d.caloriesResting,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis className="text-xs" />
                      <ChartTooltip allowEscapeViewBox={{ x: true }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="resting" stackId="cal" fill={CC.steps} name={labels.restingCalories} />
                      <Bar dataKey="active" stackId="cal" fill="#ef4444" name={labels.activeCalories} />
                    </BarChart>
                  </ResponsiveContainer>
                  </figure>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

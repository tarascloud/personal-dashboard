"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import {
  NetworkIcon,
  SmartphoneIcon,
  BabyIcon,
  ZapIcon,
  ActivityIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  ScreenTimeData,
  KidsTimeData,
  GarminHealthTrends,
} from "@/actions/dashboard";

/* ------------------------------------------------------------------ */
/* Metric definitions                                                  */
/* ------------------------------------------------------------------ */

type MetricKey = "screen" | "kids" | "battery" | "active";

interface MetricMeta {
  key: MetricKey;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Direction that counts as "good" for the trend badge color. */
  betterWhen: "up" | "down";
  /** "duration" → Xh Ym, "pct" → X%, "min" → X min */
  format: "duration" | "pct" | "min";
}

const METRICS: MetricMeta[] = [
  { key: "screen", color: "hsl(var(--chart-1))", icon: SmartphoneIcon, betterWhen: "down", format: "duration" },
  { key: "kids", color: "hsl(var(--chart-3))", icon: BabyIcon, betterWhen: "up", format: "duration" },
  { key: "battery", color: "hsl(var(--chart-2))", icon: ZapIcon, betterWhen: "up", format: "pct" },
  { key: "active", color: "hsl(var(--chart-4))", icon: ActivityIcon, betterWhen: "up", format: "min" },
];

export interface CorrelationMatrixChartProps {
  screenTime: ScreenTimeData | undefined;
  kidsTime: KidsTimeData | undefined;
  garminHealth: GarminHealthTrends | null;
  labels: {
    title: string;
    subtitle: string;
    trendsHeading: string;
    linksHeading: string;
    noData: string;
    noDataHint: string;
    noLinks: string;
    avg: string;
    relTogether: string; // "{a} та {b} зростають разом"
    relOpposite: string; // "{a} росте, коли {b} падає"
    strengthStrong: string;
    strengthModerate: string;
    strengthWeak: string;
    unitH: string;
    unitMin: string;
    // metric display names
    screen: string;
    kids: string;
    battery: string;
    active: string;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function pearson(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 5) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (denom === 0) return null;
  return cov / denom;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

export function CorrelationMatrixChart({
  screenTime,
  kidsTime,
  garminHealth,
  labels,
}: CorrelationMatrixChartProps) {
  const metricLabel = (k: MetricKey) => labels[k];

  const fmt = (k: MetricKey, v: number): string => {
    const meta = METRICS.find((m) => m.key === k)!;
    if (meta.format === "pct") return `${Math.round(v)}%`;
    const total = Math.round(v);
    if (meta.format === "min" && total < 60) return `${total} ${labels.unitMin}`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}${labels.unitH} ${m}${labels.unitMin}` : `${m}${labels.unitMin}`;
  };

  /* ---- Per-metric dense series (each from its own data) ---- */
  const series = useMemo(() => {
    const map: Record<MetricKey, Array<{ date: string; value: number }>> = {
      screen: (screenTime?.days ?? [])
        .filter((d) => Number.isFinite(d.totalMinutes))
        .map((d) => ({ date: d.date, value: d.totalMinutes })),
      kids: (kidsTime?.days ?? [])
        .filter((d) => Number.isFinite(d.minutes))
        .map((d) => ({ date: d.date, value: d.minutes })),
      battery: (garminHealth?.daily ?? [])
        .filter((d) => d.bodyBatteryHigh != null && Number.isFinite(d.bodyBatteryHigh))
        .map((d) => ({ date: d.date, value: d.bodyBatteryHigh as number })),
      active: (garminHealth?.daily ?? [])
        .filter((d) => d.intensityMinutes != null && Number.isFinite(d.intensityMinutes))
        .map((d) => ({ date: d.date, value: d.intensityMinutes as number })),
    };
    return map;
  }, [screenTime, kidsTime, garminHealth]);

  /* ---- Summary stats per metric (avg + half-over-half delta) ---- */
  const stats = useMemo(() => {
    const out = {} as Record<MetricKey, { avg: number; deltaPct: number | null; count: number }>;
    for (const m of METRICS) {
      const vals = series[m.key].map((p) => p.value);
      const count = vals.length;
      const avg = mean(vals);
      let deltaPct: number | null = null;
      if (count >= 4) {
        const mid = Math.floor(count / 2);
        const first = mean(vals.slice(0, mid));
        const second = mean(vals.slice(mid));
        if (first !== 0) deltaPct = Math.round(((second - first) / Math.abs(first)) * 100);
      }
      out[m.key] = { avg, deltaPct, count };
    }
    return out;
  }, [series]);

  /* ---- Pairwise relationships on overlapping dates ---- */
  const relationships = useMemo(() => {
    const byDate = new Map<string, Partial<Record<MetricKey, number>>>();
    for (const m of METRICS) {
      for (const p of series[m.key]) {
        const row = byDate.get(p.date) ?? {};
        row[m.key] = p.value;
        byDate.set(p.date, row);
      }
    }
    const rows = Array.from(byDate.values());

    const out: Array<{ a: MetricKey; b: MetricKey; r: number }> = [];
    for (let i = 0; i < METRICS.length; i++) {
      for (let j = i + 1; j < METRICS.length; j++) {
        const a = METRICS[i].key;
        const b = METRICS[j].key;
        const pairs: Array<[number, number]> = [];
        for (const row of rows) {
          const x = row[a];
          const y = row[b];
          if (x != null && y != null) pairs.push([x, y]);
        }
        const r = pearson(pairs);
        if (r != null && Math.abs(r) >= 0.3) out.push({ a, b, r });
      }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 3);
  }, [series]);

  const strengthLabel = (r: number) => {
    const a = Math.abs(r);
    if (a >= 0.6) return labels.strengthStrong;
    if (a >= 0.45) return labels.strengthModerate;
    return labels.strengthWeak;
  };

  const hasAnyData = METRICS.some((m) => stats[m.key].count >= 2);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <NetworkIcon className="size-4" />
          {labels.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAnyData ? (
          <EmptyState icon={NetworkIcon} title={labels.noData} description={labels.noDataHint} compact />
        ) : (
          <>
            {/* === Part A: trend cards === */}
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.trendsHeading}
              </h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {METRICS.map((m) => {
                  const s = stats[m.key];
                  const data = series[m.key];
                  const Icon = m.icon;
                  const hasData = s.count >= 2;
                  // good direction → green, bad → red; betterWhen tells which sign is good
                  const isGood =
                    s.deltaPct == null
                      ? null
                      : m.betterWhen === "up"
                        ? s.deltaPct >= 0
                        : s.deltaPct <= 0;
                  const TrendIcon = s.deltaPct == null ? null : s.deltaPct >= 0 ? TrendingUpIcon : TrendingDownIcon;

                  return (
                    <div key={m.key} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5" style={{ color: m.color }} />
                        <span className="truncate">{metricLabel(m.key)}</span>
                      </div>

                      {hasData ? (
                        <>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-semibold tabular-nums">
                              {fmt(m.key, s.avg)}
                            </span>
                            {s.deltaPct != null && TrendIcon && (
                              <span
                                className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
                                style={{ color: isGood ? "hsl(142 70% 40%)" : "hsl(0 70% 50%)" }}
                              >
                                <TrendIcon className="size-3" />
                                {Math.abs(s.deltaPct)}%
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{labels.avg}</div>

                          <ResponsiveContainer width="100%" height={40} className="mt-2">
                            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                                  <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <YAxis hide domain={["dataMin", "dataMax"]} />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke={m.color}
                                strokeWidth={1.75}
                                fill={`url(#grad-${m.key})`}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </>
                      ) : (
                        <div className="mt-3 text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* === Part B: plain-language relationships === */}
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.linksHeading}
              </h3>
              {relationships.length === 0 ? (
                <p className="text-sm text-muted-foreground">{labels.noLinks}</p>
              ) : (
                <ul className="space-y-2">
                  {relationships.map(({ a, b, r }) => {
                    const positive = r >= 0;
                    const RelIcon = positive ? ArrowUpRightIcon : ArrowDownRightIcon;
                    const tmpl = positive ? labels.relTogether : labels.relOpposite;
                    const sentence = tmpl
                      .replace("{a}", metricLabel(a))
                      .replace("{b}", metricLabel(b));
                    return (
                      <li
                        key={`${a}-${b}`}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3"
                      >
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: positive ? "hsla(142,70%,40%,0.12)" : "hsla(28,90%,50%,0.12)",
                            color: positive ? "hsl(142 70% 35%)" : "hsl(28 90% 45%)",
                          }}
                        >
                          <RelIcon className="size-4" />
                        </span>
                        <span className="flex-1 text-sm">{sentence}</span>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {strengthLabel(r)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

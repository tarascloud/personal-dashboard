"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ScreenTimeCategoryBreakdown } from "@/actions/dashboard";

/* ------------------------------------------------------------------ */
/* Color palette for categories (up to 6)                              */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6, 280 60% 55%))",
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface ScreenTimeCategoriesProps {
  categories: ScreenTimeCategoryBreakdown[];
  tooltipStyle: React.CSSProperties;
  minutesLabel: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ScreenTimeCategories({
  categories,
  tooltipStyle,
  minutesLabel,
}: ScreenTimeCategoriesProps) {
  if (categories.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
        No category data
      </div>
    );
  }

  const data = categories
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          dataKey="minutes"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            const v = Number(value ?? 0);
            return [`${Math.floor(v / 60)}h ${v % 60}m`, minutesLabel];
          }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => <span className="capitalize">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

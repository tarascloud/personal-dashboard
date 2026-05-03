"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-colors";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { FilterIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface IncomeExpensesChartProps {
  chartData: { name: string; income: number; expenses: number; expensesByCategory?: Record<string, number> }[];
  titleLabel: string;
  tooltipStyle: React.CSSProperties;
  incomeLabel?: string;
  expensesLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Category colors                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

const STORAGE_KEY = "pd:dashboard:income-expenses:selected-categories";
const INCOME_STORAGE_KEY = "pd:dashboard:income-expenses:income-visible";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function IncomeExpensesChart({
  chartData,
  titleLabel,
  incomeLabel = "Income",
  expensesLabel = "Expenses",
}: IncomeExpensesChartProps) {
  const { colors: CC } = useChartColors();
  const t = useTranslations("dashboard");

  // Collect all unique expense categories across all months
  const allCategories = useMemo(() => {
    const catSet = new Set<string>();
    for (const d of chartData) {
      if (d.expensesByCategory) {
        for (const cat of Object.keys(d.expensesByCategory)) catSet.add(cat);
      }
    }
    return Array.from(catSet).sort();
  }, [chartData]);

  const hasCategories = allCategories.length > 0;

  // null = "all selected" (default). Set = explicit subset.
  const [selectedCategories, setSelectedCategories] = useState<Set<string> | null>(null);
  const [incomeVisible, setIncomeVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Restore selection from localStorage once on mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedCategories(new Set(parsed.filter((x): x is string => typeof x === "string")));
        }
      }
      const incomeRaw = typeof window !== "undefined" ? window.localStorage.getItem(INCOME_STORAGE_KEY) : null;
      if (incomeRaw === "false") setIncomeVisible(false);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration to avoid wiping on first render)
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (selectedCategories === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedCategories)));
      }
      if (incomeVisible) {
        window.localStorage.removeItem(INCOME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(INCOME_STORAGE_KEY, "false");
      }
    } catch {
      // ignore quota / private mode
    }
  }, [selectedCategories, incomeVisible, hydrated]);

  // Effective filter: which categories actually go on the chart
  const visibleCategories = useMemo(() => {
    if (!hasCategories) return [] as string[];
    if (selectedCategories === null) return allCategories;
    return allCategories.filter((c) => selectedCategories.has(c));
  }, [allCategories, selectedCategories, hasCategories]);

  // Flatten data: income bar + stacked expense category bars (filtered)
  const flatData = useMemo(() => {
    return chartData.map((d) => {
      const row: Record<string, string | number> = { name: d.name };
      if (incomeVisible) row.income = d.income;
      if (d.expensesByCategory && visibleCategories.length > 0) {
        for (const cat of visibleCategories) {
          row[`exp_${cat}`] = d.expensesByCategory[cat] ?? 0;
        }
      } else if (!hasCategories) {
        row.expenses = d.expenses;
      }
      return row;
    });
  }, [chartData, visibleCategories, hasCategories, incomeVisible]);

  const totalIncome = incomeVisible ? chartData.reduce((s, d) => s + d.income, 0) : 0;
  const totalExpenses = useMemo(() => {
    if (!hasCategories) {
      return chartData.reduce((s, d) => s + d.expenses, 0);
    }
    return chartData.reduce((s, d) => {
      if (!d.expensesByCategory) return s;
      let monthSum = 0;
      for (const cat of visibleCategories) {
        monthSum += d.expensesByCategory[cat] ?? 0;
      }
      return s + monthSum;
    }, 0);
  }, [chartData, visibleCategories, hasCategories]);
  const totalDiff = Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Stable color per category regardless of which subset is visible
  const colorForCategory = (cat: string) =>
    CATEGORY_COLORS[allCategories.indexOf(cat) % CATEGORY_COLORS.length];

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const base = prev ?? new Set(allCategories);
      const next = new Set(base);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      // Treat "all selected" as null so future categories auto-include
      if (next.size === allCategories.length) return null;
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCategories(null);
    setIncomeVisible(true);
  };
  const clearAll = () => {
    setSelectedCategories(new Set());
    setIncomeVisible(false);
  };

  const selectedCatCount = selectedCategories === null ? allCategories.length : selectedCategories.size;
  const totalItems = allCategories.length + 1; // +1 for income
  const selectedCount = selectedCatCount + (incomeVisible ? 1 : 0);
  const isAllSelected = selectedCategories === null && incomeVisible;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>{titleLabel}</span>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs font-normal"
                  />
                }
              >
                <FilterIcon className="size-3.5" />
                <span>{t("chart_categories_filter")}</span>
                <span className="text-muted-foreground">
                  {isAllSelected
                    ? t("chart_categories_all")
                    : t("chart_categories_count", { selected: selectedCount, total: totalItems })}
                </span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("chart_categories_select_all")}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {t("chart_categories_clear")}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={incomeVisible}
                      onCheckedChange={() => setIncomeVisible((v) => !v)}
                    />
                    <span
                      className="inline-block size-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: CC.income }}
                      aria-hidden
                    />
                    <span className="truncate">{incomeLabel}</span>
                  </label>
                  {hasCategories && allCategories.map((cat) => {
                    const checked = selectedCategories === null || selectedCategories.has(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        <span
                          className="inline-block size-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: colorForCategory(cat) }}
                          aria-hidden
                        />
                        <span className="truncate">{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <span className={`text-sm font-medium ${totalDiff >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totalDiff >= 0 ? "+" : ""}{totalDiff.toLocaleString("en")} EUR
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 sm:h-72">
          <figure role="img" style={{ height: "100%" }} aria-label="Графік доходів та витрат">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flatData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis className="text-xs" />
              <ChartTooltip
                formatter={(value, name) => {
                  const label = name === "income" ? incomeLabel
                    : name === "expenses" ? expensesLabel
                    : String(name).startsWith("exp_") ? String(name).slice(4)
                    : String(name);
                  return [`EUR ${Number(value).toLocaleString("en")}`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => {
                  if (value === "income") return incomeLabel;
                  if (value === "expenses") return expensesLabel;
                  if (value.startsWith("exp_")) return value.slice(4);
                  return value;
                }}
              />
              {incomeVisible && (
                <Bar dataKey="income" fill={CC.income} radius={[4, 4, 0, 0]} name="income" />
              )}
              {hasCategories ? (
                visibleCategories.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={`exp_${cat}`}
                    stackId="expenses"
                    fill={colorForCategory(cat)}
                    name={`exp_${cat}`}
                  />
                ))
              ) : (
                <Bar dataKey="expenses" fill={CC.expense} radius={[4, 4, 0, 0]} name="expenses" />
              )}
            </BarChart>
          </ResponsiveContainer>
          </figure>
        </div>
      </CardContent>
    </Card>
  );
}

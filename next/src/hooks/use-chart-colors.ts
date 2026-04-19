"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  getChartColors,
  getTooltipStyle,
  getTooltipItemStyle,
  getTooltipLabelStyle,
  getMuscleGroupColors,
  CHART_COLORS,
  type ChartColors,
} from "@/lib/chart-theme";

/**
 * Returns theme-aware chart colors by reading CSS custom properties.
 * Re-computes when the theme changes (via next-themes).
 */
export function useChartColors(): {
  colors: ChartColors;
  tooltipStyle: React.CSSProperties;
  tooltipItemStyle: React.CSSProperties;
  tooltipLabelStyle: React.CSSProperties;
  muscleGroupColors: Record<string, string>;
} {
  const { resolvedTheme } = useTheme();

  return useMemo(() => {
    // resolvedTheme is used as a dependency to re-compute on theme change.
    // getChartColors() reads from the DOM, which already reflects the new theme.
    const colors = typeof document !== "undefined" ? getChartColors() : CHART_COLORS;
    const tooltipStyle = getTooltipStyle();
    const tooltipItemStyle = getTooltipItemStyle();
    const tooltipLabelStyle = getTooltipLabelStyle();
    const muscleGroupColors = getMuscleGroupColors(colors);
    return { colors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, muscleGroupColors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);
}

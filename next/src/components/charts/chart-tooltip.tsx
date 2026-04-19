"use client";

import { Tooltip } from "recharts";
import type { ComponentProps } from "react";
import { useChartColors } from "@/hooks/use-chart-colors";

type TooltipProps = ComponentProps<typeof Tooltip>;

/**
 * Recharts Tooltip preset with theme-aware styles.
 *
 * Recharts defaults item text color to the series fill/stroke, which blends
 * with the bar/line and becomes unreadable. This wrapper forces text to use
 * --card-foreground so values stay legible on both light and dark themes.
 */
export function ChartTooltip(
  props: Omit<TooltipProps, "contentStyle" | "itemStyle" | "labelStyle">,
) {
  const { tooltipStyle, tooltipItemStyle, tooltipLabelStyle } = useChartColors();
  return (
    <Tooltip
      {...props}
      contentStyle={tooltipStyle}
      itemStyle={tooltipItemStyle}
      labelStyle={tooltipLabelStyle}
    />
  );
}

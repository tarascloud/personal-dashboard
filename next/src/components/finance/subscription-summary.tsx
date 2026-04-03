"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SubscriptionAnalytics } from "@/actions/finance/subscriptions";

interface SubscriptionSummaryProps {
  analytics: SubscriptionAnalytics;
}

export function SubscriptionSummary({ analytics }: SubscriptionSummaryProps) {
  const t = useTranslations("subscriptions");

  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("monthly_cost")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {analytics.totalMonthly.toFixed(2)} EUR
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("yearly_cost")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {analytics.totalYearly.toFixed(2)} EUR
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("total_spent")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {analytics.totalAllTime.toFixed(2)} EUR
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("active_subscriptions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {analytics.activeCount}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {analytics.inactiveCount}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

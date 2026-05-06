"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  ExternalLinkIcon,
  CalendarIcon,
  TrendingUpIcon,
  ReceiptIcon,
} from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import {
  type SubscriptionData,
  type SubscriptionSpending,
} from "@/actions/finance/subscriptions";
import { cn } from "@/lib/utils";
import { getBrandColors } from "@/lib/subscription-brands";

function getAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ---------- Types ----------

type SubWithSpending = SubscriptionData & { spending: SubscriptionSpending | null };

interface SubscriptionListProps {
  subscriptions: SubWithSpending[];
  isPending: boolean;
  onEdit: (sub: SubscriptionData) => void;
  onDelete: (sub: SubscriptionData) => void;
  onToggleActive: (sub: SubscriptionData) => void;
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "monthly",
  yearly: "yearly",
  weekly: "weekly",
};

// ---------- Component ----------

export function SubscriptionList({
  subscriptions,
  isPending,
  onEdit,
  onDelete,
  onToggleActive,
}: SubscriptionListProps) {
  const t = useTranslations("subscriptions");

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("no_subscriptions")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {subscriptions.map((sub) => {
        const brand = getBrandColors(sub.name);
        const abbr = getAbbreviation(sub.name);
        const cycleKey = CYCLE_LABELS[sub.billingCycle] ?? "monthly";

        return (
          <Card
            key={sub.id}
            className={cn(
              "transition-opacity duration-200",
              !sub.isActive && "opacity-50",
            )}
          >
            <CardContent className="p-4 space-y-3">
              {/* Header: avatar + name/provider + toggle */}
              <div className="flex items-start gap-3">
                {/* Brand avatar */}
                <div
                  className={cn(
                    "flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm select-none",
                    brand.bg,
                    brand.text,
                  )}
                  aria-hidden="true"
                >
                  {abbr}
                </div>

                {/* Name + provider */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold leading-tight truncate">{sub.name}</h3>
                  {sub.provider && sub.provider !== sub.name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {sub.provider}
                    </p>
                  )}
                </div>

                {/* Active toggle */}
                <Switch
                  checked={sub.isActive}
                  onCheckedChange={() => onToggleActive(sub)}
                  disabled={isPending}
                  aria-label={sub.isActive ? t("active") : t("inactive")}
                  className="flex-shrink-0 mt-0.5"
                />
              </div>

              {/* Amount */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums tracking-tight">
                  {sub.amount.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {sub.currency}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {t(cycleKey as Parameters<typeof t>[0])}
                </span>
              </div>

              {/* Meta: next billing + spending */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {sub.nextBilling && (
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {t("next_billing")}:{" "}
                      <span className="text-foreground font-medium">{sub.nextBilling}</span>
                    </span>
                  </div>
                )}

                {sub.spending && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUpIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {t("total_spent")}:{" "}
                      <span className="text-foreground font-medium">
                        €{sub.spending.totalSpent.toFixed(2)}
                      </span>
                      {" "}
                      <span className="opacity-70">
                        {t("since")} {sub.spending.firstDate}
                      </span>
                    </span>
                  </div>
                )}

                {sub.notes && (
                  <p className="italic opacity-70 truncate">{sub.notes}</p>
                )}
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                {/* Status chip */}
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    sub.isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {sub.isActive ? t("active") : t("inactive")}
                </span>

                {/* Icon actions */}
                <div className="flex items-center gap-0.5">
                  <Link
                    href={`/finance/transactions?search=${encodeURIComponent(
                      sub.spending?.matchedDescriptions?.length
                        ? sub.spending.matchedDescriptions.join("|")
                        : sub.name
                    )}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title={sub.spending ? t("transactions_count", { count: sub.spending.transactionCount }) : "Transactions"}
                  >
                    <ReceiptIcon className="h-3.5 w-3.5" />
                  </Link>
                  {sub.url && (
                    <a
                      href={sub.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(sub)}
                    disabled={isPending}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(sub)}
                    disabled={isPending}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

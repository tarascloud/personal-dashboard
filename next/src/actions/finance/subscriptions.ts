"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

// ---------- Types ----------

export type SubscriptionData = {
  id: number;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBilling: string | null;
  category: string | null;
  isActive: boolean;
  url: string | null;
  notes: string | null;
};

// ---------- Read ----------

export async function getSubscriptions(): Promise<SubscriptionData[]> {
  const user = await requireUser();
  const rows = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { nextBilling: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    amount: r.amount,
    currency: r.currency,
    billingCycle: r.billingCycle,
    nextBilling: r.nextBilling ? r.nextBilling.toISOString().slice(0, 10) : null,
    category: r.category,
    isActive: r.isActive,
    url: r.url,
    notes: r.notes,
  }));
}

// ---------- Create ----------

export async function addSubscription(data: {
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBilling?: string;
  category?: string;
  isActive?: boolean;
  url?: string;
  notes?: string;
}) {
  const user = await requireUser();
  await prisma.subscription.create({
    data: {
      userId: user.id,
      name: data.name,
      provider: data.provider,
      amount: data.amount,
      currency: data.currency,
      billingCycle: data.billingCycle,
      nextBilling: data.nextBilling ? new Date(data.nextBilling) : null,
      category: data.category || null,
      isActive: data.isActive ?? true,
      url: data.url || null,
      notes: data.notes || null,
    },
  });
  updateTag(CACHE_TAGS.finance);
}

// ---------- Update ----------

export async function updateSubscription(
  id: number,
  data: {
    name?: string;
    provider?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    nextBilling?: string | null;
    category?: string | null;
    isActive?: boolean;
    url?: string | null;
    notes?: string | null;
  },
) {
  const user = await requireUser();
  // Verify ownership
  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Not found");

  await prisma.subscription.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.provider !== undefined && { provider: data.provider }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.billingCycle !== undefined && { billingCycle: data.billingCycle }),
      ...(data.nextBilling !== undefined && {
        nextBilling: data.nextBilling ? new Date(data.nextBilling) : null,
      }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
  updateTag(CACHE_TAGS.finance);
}

// ---------- Delete ----------

export async function deleteSubscription(id: number) {
  const user = await requireUser();
  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Not found");
  await prisma.subscription.delete({ where: { id } });
  updateTag(CACHE_TAGS.finance);
}

// ---------- Analytics: spending from transactions ----------

export type SubscriptionSpending = {
  name: string;
  totalSpent: number;
  monthlyAvg: number;
  yearlyTotal: number;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  matchedDescriptions: string[];
};

export type SubscriptionAnalytics = {
  totalMonthly: number;
  totalYearly: number;
  totalAllTime: number;
  activeCount: number;
  inactiveCount: number;
  subscriptions: (SubscriptionData & { spending: SubscriptionSpending | null })[];
};

/**
 * Get subscription analytics with actual spending from transactions.
 * Matches subscription names against transaction descriptions in the "Підписки" category.
 */
export async function getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
  const user = await requireUser();

  // Get all user subscriptions
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { amount: "desc" }],
  });

  // Get all subscription-category transactions
  const txns = await prisma.$queryRaw<Array<{
    description: string;
    amount_eur: number;
    date: Date;
  }>>`
    SELECT description, amount_eur, date
    FROM transactions
    WHERE user_id = ${user.id}
      AND category = 'Підписки'
      AND description IS NOT NULL
    ORDER BY date DESC
  `;

  // Match transactions to subscriptions
  const spendingMap = new Map<string, SubscriptionSpending>();

  for (const sub of subs) {
    const nameLC = sub.name.toLowerCase();
    const matched = txns.filter((tx) => {
      const desc = (tx.description || "").toLowerCase();
      // Match subscription name in transaction description
      if (nameLC === "netflix" && desc.includes("netflix") && !desc.includes("spotify")) return true;
      if (nameLC === "spotify" && desc.includes("spotify")) return true;
      if (nameLC === "icloud" && desc.includes("icloud")) return true;
      if (nameLC === "youtube premium" && desc.includes("youtube")) return true;
      if (nameLC === "claude pro" && desc.includes("claude")) return true;
      if (nameLC === "github" && desc.includes("github")) return true;
      if (nameLC === "cloudflare" && desc.includes("cloudflare")) return true;
      if (nameLC === "google one" && desc.includes("google") && !desc.includes("music") && !desc.includes("play")) return true;
      if (nameLC === "openai" && (desc.includes("openai") || desc === "gpt" || desc === "ai" || desc === "open ai")) return true;
      if (nameLC === "forus" && desc.includes("forus")) return true;
      if (nameLC === "tie" && desc === "tie") return true;
      if (nameLC === "amazon prime" && desc.includes("amazon")) return true;
      if (nameLC === "docker" && desc.includes("docker")) return true;
      if (nameLC === "duolingo" && desc.includes("duolingo")) return true;
      if (nameLC === "homemoney" && (desc.includes("homemoney") || desc.includes("home money"))) return true;
      if (nameLC === "xbox game pass" && desc.includes("xbox")) return true;
      // Also match bundled transactions proportionally (skip for now, just exact matches)
      return false;
    });

    if (matched.length > 0) {
      const amounts = matched.map((tx) => Math.abs(tx.amount_eur));
      const total = amounts.reduce((a, b) => a + b, 0);
      const dates = matched.map((tx) => tx.date);
      const firstDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const lastDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      const monthsSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 86400000));

      const uniqueDescs = [...new Set(matched.map((tx) => tx.description))];
      spendingMap.set(sub.name, {
        name: sub.name,
        totalSpent: Math.round(total * 100) / 100,
        monthlyAvg: Math.round((total / monthsSpan) * 100) / 100,
        yearlyTotal: Math.round((total / monthsSpan) * 12 * 100) / 100,
        transactionCount: matched.length,
        firstDate: firstDate.toISOString().slice(0, 10),
        lastDate: lastDate.toISOString().slice(0, 10),
        matchedDescriptions: uniqueDescs,
      });
    }
  }

  // Also account for bundled "Netflix + Spotify + iCloud" transactions
  const bundled = txns.filter((tx) => {
    const d = (tx.description || "").toLowerCase();
    return d.includes("netflix") && d.includes("spotify");
  });
  if (bundled.length > 0) {
    const bundleTotal = bundled.reduce((a, tx) => a + Math.abs(tx.amount_eur), 0);
    // Distribute proportionally: Netflix ~47%, Spotify ~31%, iCloud ~22% (based on current prices)
    const distribute = (subName: string, pct: number) => {
      const existing = spendingMap.get(subName);
      const extra = Math.round(bundleTotal * pct * 100) / 100;
      if (existing) {
        existing.totalSpent = Math.round((existing.totalSpent + extra) * 100) / 100;
        existing.transactionCount += bundled.length;
        const dates = bundled.map((tx) => tx.date);
        const firstDate = new Date(Math.min(new Date(existing.firstDate).getTime(), ...dates.map((d) => d.getTime())));
        const lastDate = new Date(Math.max(new Date(existing.lastDate).getTime(), ...dates.map((d) => d.getTime())));
        existing.firstDate = firstDate.toISOString().slice(0, 10);
        existing.lastDate = lastDate.toISOString().slice(0, 10);
        const monthsSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 86400000));
        existing.monthlyAvg = Math.round((existing.totalSpent / monthsSpan) * 100) / 100;
        existing.yearlyTotal = Math.round(existing.monthlyAvg * 12 * 100) / 100;
      }
    };
    distribute("Netflix", 0.47);
    distribute("Spotify", 0.31);
    distribute("iCloud", 0.22);
  }

  const subsData = subs.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    amount: r.amount,
    currency: r.currency,
    billingCycle: r.billingCycle,
    nextBilling: r.nextBilling ? r.nextBilling.toISOString().slice(0, 10) : null,
    category: r.category,
    isActive: r.isActive,
    url: r.url,
    notes: r.notes,
    spending: spendingMap.get(r.name) || null,
  }));

  const active = subsData.filter((s) => s.isActive);
  let totalMonthly = 0;
  for (const s of active) {
    if (s.billingCycle === "yearly") totalMonthly += s.amount / 12;
    else if (s.billingCycle === "weekly") totalMonthly += s.amount * (52 / 12);
    else totalMonthly += s.amount;
  }

  const totalAllTime = subsData.reduce((a, s) => a + (s.spending?.totalSpent ?? 0), 0);

  return {
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalYearly: Math.round(totalMonthly * 12 * 100) / 100,
    totalAllTime: Math.round(totalAllTime * 100) / 100,
    activeCount: active.length,
    inactiveCount: subsData.length - active.length,
    subscriptions: subsData,
  };
}

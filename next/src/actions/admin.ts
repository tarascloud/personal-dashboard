"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/current-user";

// Admin data and fixes are in separate modules: admin-data.ts, admin-fixes.ts

// ── User Management ──

export async function getUsers() {
  await requireOwner();
  return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
}

export async function inviteUser(email: string) {
  const owner = await requireOwner();
  await prisma.$transaction(async (tx) => {
    await tx.guestInvite.create({
      data: {
        email,
        invitedBy: owner.email,
      },
    });
    await tx.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "invite_user",
        details: `Invited ${email}`,
      },
    });
  });
}

// REV-20260512-070: explicit allowlists for user-data tables.
// Discovery via information_schema would let a future stray table with `user_id`
// column be silently included (or worse, a typo-named table targeted via
// metadata trick). Hardcoded lists make the blast radius of removeUser auditable
// at code-review time.
const USER_ID_TABLES = [
  "transactions",
  "budgets",
  "budget_config",
  "recurring_transactions",
  "custom_accounts",
  "custom_categories",
  "category_favourites",
  "mandatory_categories",
  "savings_goals",
  "gym_workouts",
  "gym_sets",
  "gym_exercises",
  "gym_programs",
  "gym_program_days",
  "gym_program_exercises",
  "gym_workout_exercises",
  "garmin_daily",
  "garmin_sleep",
  "garmin_activities",
  "garmin_body_composition",
  "garmin_heart_rate",
  "garmin_staging",
  "withings_measurements",
  "screen_time",
  "daily_log",
  "food_log",
  "secrets",
  "broker_positions",
  "broker_account_summaries",
  "broker_transactions",
  "tax_declarations",
  "tax_documents",
  "tax_simulations",
  "tax_income_records",
  "tax_deadlines",
  "tax_declaration_items",
  "tax_receipts",
  "ai_notes",
  "ai_context_snapshots",
  "chat_history",
  "user_preferences",
  "shopping_items",
  "shopping_history",
  "portfolio_snapshots",
  "sync_failures",
  "embeddings",
  "big_purchases",
  "subscriptions",
] as const;

const USER_EMAIL_TABLES = [
  "telegram_links",
  // audit_log is intentionally excluded — we keep audit history.
] as const;

// PostgreSQL identifier safe pattern: letters, digits, underscores.
// All entries above satisfy this; verify defensively to make the safety
// of `"${name}"` interpolation locally provable.
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeTable(name: string): void {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`Unsafe table identifier: ${name}`);
  }
}

export async function removeUser(email: string) {
  const owner = await requireOwner();
  if (email === owner.email) {
    throw new Error("Cannot delete yourself");
  }
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) throw new Error("User not found");

  await prisma.$transaction(async (tx) => {
    for (const table of USER_ID_TABLES) {
      assertSafeTable(table);
      await tx.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE user_id = $1`,
        target.id,
      );
    }
    for (const table of USER_EMAIL_TABLES) {
      assertSafeTable(table);
      await tx.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE user_email = $1`,
        email,
      );
    }
    await tx.user.delete({ where: { email } });
    await tx.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "remove_user",
        details: `Removed ${email}`,
      },
    });
  });
}

export async function changeRole(email: string, role: string) {
  const owner = await requireOwner();
  if (email === owner.email) {
    throw new Error("Cannot change own role");
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email },
      data: { role },
    });
    await tx.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "change_role",
        details: `Changed ${email} role to ${role}`,
      },
    });
  });
}

// ── Guest Management (P7.7) ──

export async function inviteGuest(email: string, role: string) {
  const owner = await requireOwner();
  await prisma.$transaction(async (tx) => {
    await tx.guestInvite.create({
      data: { email, invitedBy: owner.email },
    });
    await tx.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "invite_guest",
        details: `Invited ${email} as ${role}`,
      },
    });
  });
}

export async function revokeInvite(id: string) {
  const owner = await requireOwner();
  await prisma.$transaction(async (tx) => {
    await tx.guestInvite.delete({ where: { email: id } });
    await tx.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "revoke_invite",
        details: `Revoked invite for ${id}`,
      },
    });
  });
}

export async function getInvites() {
  await requireOwner();
  return prisma.guestInvite.findMany({ orderBy: { createdAt: "desc" } });
}

// ── Telegram Links ──

export async function getTelegramLinks() {
  await requireOwner();
  return prisma.telegramLink.findMany({
    orderBy: { userEmail: "asc" },
  });
}

export async function unlinkTelegram(telegramId: number) {
  const owner = await requireOwner();
  await prisma.$transaction([
    prisma.telegramLink.delete({ where: { telegramId } }),
    prisma.auditLog.create({
      data: {
        userEmail: owner.email,
        action: "unlink_telegram",
        details: `Unlinked telegram_id ${telegramId}`,
      },
    }),
  ]);
}

import { dateToString } from "@/lib/date-utils";

// ── Admin Stats (P8.2) ──

export async function getAdminStats() {
  await requireOwner();
  const users = await prisma.user.findMany({ select: { role: true } });
  const total = users.length;
  const owners = users.filter((u) => u.role === "owner").length;
  const usersCount = users.filter((u) => u.role === "user").length;
  const guests = users.filter((u) => u.role === "guest").length;
  return { total, owners, users: usersCount, guests };
}

// ── Export User Data (P8.3) ──

export async function exportUserDataCsv(userEmail: string): Promise<string> {
  await requireOwner();
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) throw new Error("User not found");
  const uid = user.id;

  const transactions = await prisma.transaction.findMany({
    where: { userId: uid },
    orderBy: { date: "desc" },
    take: 10000,
  });

  const header =
    "id,date,type,account,category,amount_eur,description,source";
  const lines = transactions.map((r) =>
    [
      r.id,
      dateToString(r.date),
      r.type ?? "",
      csvEsc(r.account ?? ""),
      csvEsc(r.category ?? ""),
      r.amountEur ?? "",
      csvEsc(r.description ?? ""),
      r.source ?? "",
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function csvEsc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// ── Monitoring ──

export async function getMonitoringStats() {
  await requireOwner();
  const [txCount, dailyLogCount, foodLogCount, workoutCount, userCount] = await Promise.all([
    prisma.transaction.count(),
    prisma.dailyLog.count(),
    prisma.foodLog.count(),
    prisma.gymWorkout.count(),
    prisma.user.count(),
  ]);

  // Get date range of data
  const oldestTx = await prisma.transaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
  const newestTx = await prisma.transaction.findFirst({ orderBy: { date: "desc" }, select: { date: true } });

  return {
    transactions: txCount,
    dailyLogs: dailyLogCount,
    foodLogs: foodLogCount,
    workouts: workoutCount,
    users: userCount,
    dataFrom: oldestTx ? dateToString(oldestTx.date) : null,
    dataTo: newestTx ? dateToString(newestTx.date) : null,
  };
}

export async function getErrorLogs(limit = 100) {
  await requireOwner();
  return prisma.auditLog.findMany({
    where: { action: "ERROR" },
    orderBy: { id: "desc" },
    take: limit,
  });
}

export async function clearErrorLogs() {
  await requireOwner();
  await prisma.auditLog.deleteMany({ where: { action: "ERROR" } });
}

export async function getAuditLog(limit = 50) {
  await requireOwner();
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Data Overview ──

export type TableInfo = {
  name: string;
  count: number;
  label?: string;
};

export type IntegrationInfo = {
  integration: string;
  users: number;
  keys: string[];
};

export type DataOverviewCategory = {
  icon: string;
  title: string;
  tables: TableInfo[];
};

export type PerUserCounts = {
  name: string | null;
  email: string;
  tables: Record<string, number>;
  total: number;
};

export type DataOverview = {
  categories: DataOverviewCategory[];
  integrations: IntegrationInfo[];
  perUser: Record<string, PerUserCounts>;
};

export async function getDataOverview(): Promise<DataOverview> {
  await requireOwner();

  // Use pg_class for approximate counts — instant vs 40+ sequential COUNT(*) queries.
  // reltuples is updated by VACUUM/ANALYZE and is accurate enough for admin overview.
  const tableNames = [
    'transactions', 'budgets', 'budget_config', 'recurring_transactions',
    'custom_accounts', 'custom_categories', 'category_favourites',
    'mandatory_categories', 'savings_goals', 'nbu_rates',
    'gym_workouts', 'gym_sets', 'gym_exercises', 'gym_programs',
    'gym_program_days', 'gym_program_exercises', 'gym_workout_exercises',
    'garmin_daily', 'garmin_sleep', 'garmin_activities',
    'garmin_body_composition', 'garmin_heart_rate', 'withings_measurements',
    'daily_log', 'food_log', 'secrets', 'broker_positions',
    'broker_account_summaries', 'broker_transactions',
    'tax_declarations', 'tax_documents', 'tax_simulations',
    'tax_income_records', 'tax_deadlines', 'tax_declaration_items',
    'tax_receipts', 'ai_notes', 'ai_context_snapshots', 'chat_history',
    'user_preferences', 'shopping_items', 'shopping_history',
    'telegram_links', 'audit_log', 'portfolio_snapshots',
    'sync_failures', 'garmin_staging',
  ] as const;

  let counts: Record<string, number> = {};
  try {
    const rows = await prisma.$queryRaw<
      Array<{ relname: string; count: number }>
    >(
      Prisma.sql`SELECT relname, GREATEST(reltuples, 0)::int as count
       FROM pg_class
       WHERE relname IN (${Prisma.join(tableNames)})`,
    );
    for (const row of rows) {
      counts[row.relname] = Number(row.count);
    }
  } catch (e) {
    console.error("[admin/getDataOverview] pg_class query failed, falling back to COUNT(*):", e);
    // Fallback: 40+ parallel count queries if pg_class approach fails
    const results = await Promise.all(
      [
        prisma.transaction.count(),
        prisma.budget.count(),
        prisma.budgetConfig.count(),
        prisma.recurringTransaction.count(),
        prisma.customAccount.count(),
        prisma.customCategory.count(),
        prisma.categoryFavourite.count(),
        prisma.mandatoryCategory.count(),
        prisma.savingsGoal.count(),
        prisma.nbuRate.count(),
        prisma.gymWorkout.count(),
        prisma.gymSet.count(),
        prisma.gymExercise.count(),
        prisma.gymProgram.count(),
        prisma.gymProgramDay.count(),
        prisma.gymProgramExercise.count(),
        prisma.gymWorkoutExercise.count(),
        prisma.garminDaily.count(),
        prisma.garminSleep.count(),
        prisma.garminActivity.count(),
        prisma.garminBodyComposition.count(),
        prisma.garminHeartRate.count(),
        prisma.withingsMeasurement.count(),
        prisma.dailyLog.count(),
        prisma.foodLog.count(),
        prisma.secret.count(),
        prisma.brokerPosition.count(),
        prisma.brokerAccountSummary.count(),
        prisma.brokerTransaction.count(),
        prisma.taxDeclaration.count(),
        prisma.taxDocument.count(),
        prisma.taxSimulation.count(),
        prisma.taxIncomeRecord.count(),
        prisma.taxDeadline.count(),
        prisma.taxDeclarationItem.count(),
        prisma.receipt.count(),
        prisma.aiNote.count(),
        prisma.aiContextSnapshot.count(),
        prisma.chatHistory.count(),
        prisma.userPreference.count(),
        prisma.shoppingItem.count(),
        prisma.shoppingHistory.count(),
        prisma.telegramLink.count(),
        prisma.auditLog.count(),
        prisma.portfolioSnapshot.count(),
        prisma.syncFailure.count(),
        prisma.garminStaging.count(),
      ],
    );
    const fallbackNames = [...tableNames];
    for (let i = 0; i < fallbackNames.length; i++) {
      counts[fallbackNames[i]] = results[i];
    }
  }

  const c = (name: string) => counts[name] ?? 0;

  // Get integration secrets grouped by key prefix
  const secretRows = await prisma.$queryRaw<
    Array<{ key: string; user_count: number }>
  >`
    SELECT key, COUNT(DISTINCT user_id)::int as user_count
    FROM secrets
    GROUP BY key
    ORDER BY key
  `;

  const integrationPrefixes: Record<string, string[]> = {
    monobank: [],
    bunq: [],
    garmin: [],
    withings: [],
    ibkr: [],
    trading212: [],
    etoro: [],
    cobee: [],
  };

  for (const row of secretRows) {
    const keyLower = row.key.toLowerCase();
    for (const prefix of Object.keys(integrationPrefixes)) {
      if (keyLower.startsWith(prefix)) {
        integrationPrefixes[prefix].push(row.key);
        break;
      }
    }
  }

  const integrations: IntegrationInfo[] = Object.entries(integrationPrefixes)
    .map(([integration, keys]) => {
      const maxUsers = keys.reduce((max, key) => {
        const row = secretRows.find((r) => r.key === key);
        return Math.max(max, row?.user_count ?? 0);
      }, 0);
      return { integration, users: maxUsers, keys };
    })
    .filter((i) => i.keys.length > 0);

  // Also collect unmatched secret keys
  const matchedKeys = new Set(Object.values(integrationPrefixes).flat());
  const unmatchedKeys = secretRows.filter((r) => !matchedKeys.has(r.key));
  if (unmatchedKeys.length > 0) {
    integrations.push({
      integration: "other",
      users: Math.max(...unmatchedKeys.map((r) => r.user_count)),
      keys: unmatchedKeys.map((r) => r.key),
    });
  }

  const categories: DataOverviewCategory[] = [
    {
      icon: "\uD83D\uDCCA",
      title: "Фінанси",
      tables: [
        { name: "transactions", count: c("transactions") },
        { name: "budgets", count: c("budgets") },
        { name: "budget_config", count: c("budget_config") },
        { name: "recurring_transactions", count: c("recurring_transactions") },
        { name: "custom_accounts", count: c("custom_accounts") },
        { name: "custom_categories", count: c("custom_categories") },
        { name: "category_favourites", count: c("category_favourites") },
        { name: "mandatory_categories", count: c("mandatory_categories") },
        { name: "savings_goals", count: c("savings_goals") },
        { name: "nbu_rates", count: c("nbu_rates") },
      ],
    },
    {
      icon: "\uD83C\uDFCB\uFE0F",
      title: "Зал & Здоров'я",
      tables: [
        { name: "gym_workouts", count: c("gym_workouts") },
        { name: "gym_sets", count: c("gym_sets") },
        { name: "gym_exercises", count: c("gym_exercises") },
        { name: "gym_programs", count: c("gym_programs") },
        { name: "gym_program_days", count: c("gym_program_days") },
        { name: "gym_program_exercises", count: c("gym_program_exercises") },
        { name: "gym_workout_exercises", count: c("gym_workout_exercises") },
        { name: "garmin_daily", count: c("garmin_daily") },
        { name: "garmin_sleep", count: c("garmin_sleep") },
        { name: "garmin_activities", count: c("garmin_activities") },
        { name: "garmin_body_composition", count: c("garmin_body_composition") },
        { name: "garmin_heart_rate", count: c("garmin_heart_rate") },
        { name: "withings_measurements", count: c("withings_measurements") },
        { name: "daily_log", count: c("daily_log") },
        { name: "food_log", count: c("food_log") },
      ],
    },
    {
      icon: "\uD83D\uDD17",
      title: "Інтеграції",
      tables: [
        { name: "secrets", count: c("secrets"), label: "secrets (all keys)" },
        { name: "broker_positions", count: c("broker_positions") },
        { name: "broker_account_summaries", count: c("broker_account_summaries") },
        { name: "broker_transactions", count: c("broker_transactions") },
        { name: "portfolio_snapshots", count: c("portfolio_snapshots") },
      ],
    },
    {
      icon: "\uD83E\uDDFE",
      title: "Звітність",
      tables: [
        { name: "tax_declarations", count: c("tax_declarations") },
        { name: "tax_declaration_items", count: c("tax_declaration_items") },
        { name: "tax_documents", count: c("tax_documents") },
        { name: "tax_simulations", count: c("tax_simulations") },
        { name: "tax_income_records", count: c("tax_income_records") },
        { name: "tax_deadlines", count: c("tax_deadlines") },
        { name: "tax_receipts", count: c("tax_receipts") },
      ],
    },
    {
      icon: "\uD83E\uDD16",
      title: "AI & Chat",
      tables: [
        { name: "ai_notes", count: c("ai_notes") },
        { name: "ai_context_snapshots", count: c("ai_context_snapshots") },
        { name: "chat_history", count: c("chat_history") },
      ],
    },
    {
      icon: "\uD83D\uDCCB",
      title: "Інше",
      tables: [
        { name: "user_preferences", count: c("user_preferences") },
        { name: "shopping_items", count: c("shopping_items") },
        { name: "shopping_history", count: c("shopping_history") },
        { name: "telegram_links", count: c("telegram_links") },
        { name: "audit_log", count: c("audit_log") },
        { name: "sync_failures", count: c("sync_failures") },
        { name: "garmin_staging", count: c("garmin_staging") },
      ],
    },
  ];

  // Per-user counts for key data tables — single efficient SQL query
  const perUserRows = await prisma.$queryRaw<
    Array<{ user_id: string; table_name: string; cnt: number }>
  >`
    SELECT user_id, table_name, cnt FROM (
      SELECT user_id, 'transactions' as table_name, COUNT(*)::int as cnt FROM transactions GROUP BY user_id
      UNION ALL
      SELECT user_id, 'daily_log', COUNT(*)::int FROM daily_log GROUP BY user_id
      UNION ALL
      SELECT user_id, 'garmin_daily', COUNT(*)::int FROM garmin_daily GROUP BY user_id
      UNION ALL
      SELECT user_id, 'gym_workouts', COUNT(*)::int FROM gym_workouts GROUP BY user_id
      UNION ALL
      SELECT user_id, 'food_log', COUNT(*)::int FROM food_log GROUP BY user_id
      UNION ALL
      SELECT user_id, 'broker_positions', COUNT(*)::int FROM broker_positions GROUP BY user_id
      UNION ALL
      SELECT user_id, 'chat_history', COUNT(*)::int FROM chat_history GROUP BY user_id
      UNION ALL
      SELECT user_id, 'shopping_items', COUNT(*)::int FROM shopping_items GROUP BY user_id
    ) sub
  `;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  const perUser: Record<string, PerUserCounts> = {};

  for (const row of perUserRows) {
    if (!perUser[row.user_id]) {
      const user = userMap.get(Number(row.user_id));
      perUser[row.user_id] = {
        name: user?.name ?? null,
        email: user?.email ?? row.user_id,
        tables: {},
        total: 0,
      };
    }
    perUser[row.user_id].tables[row.table_name] = Number(row.cnt);
    perUser[row.user_id].total += Number(row.cnt);
  }

  return { categories, integrations, perUser };
}

// REV-20260512-078: fixMissingCurrencyConversion() lives in admin-fixes.ts.
// The duplicate that previously lived here was unused (admin-page.tsx
// already imported from "@/actions/admin-fixes") and only added LOC weight.

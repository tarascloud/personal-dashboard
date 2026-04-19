import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Wallet,
  TrendingUp,
  Heart,
  Dumbbell,
  Bot,
  Sun,
  UtensilsCrossed,
  ShoppingCart,
  BarChart3,
  FileText,
  Link2,
  Server,
  ShieldCheck,
  Globe,
  Github,
  ExternalLink,
  ChevronRight,
  Zap,
  Database,
  Lock,
  Smartphone,
  Activity,
  Brain,
  Calculator,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: `${t("title")} — About`,
    description: t("meta_description"),
  };
}

/* ------------------------------------------------------------------ */
/* Feature card                                                        */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon,
  title,
  desc,
  screenshot,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  screenshot: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-[#FFC700]/30 hover:bg-white/[0.04]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFC700]/10 text-[#FFC700]">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-[#9a9ea6]">{desc}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/screenshots/${screenshot}.png?v=20260324`}
        alt={title}
        loading="lazy"
        className="mt-4 rounded-lg border border-white/[0.06] w-full"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integration badge                                                   */
/* ------------------------------------------------------------------ */

function IntBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#9a9ea6] transition-colors hover:border-[#FFC700]/30 hover:text-white">
      <Link2 className="h-3 w-3 text-[#FFC700]/60" />
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tech badge                                                          */
/* ------------------------------------------------------------------ */

function TechBadge({
  icon,
  name,
}: {
  icon: React.ReactNode;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-[#9a9ea6]">
      {icon}
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function AboutPage() {
  const t = await getTranslations("about");

  const features = [
    { icon: <Wallet className="h-5 w-5" />, key: "finance", screenshot: "finance" },
    { icon: <TrendingUp className="h-5 w-5" />, key: "investments", screenshot: "investments" },
    { icon: <Heart className="h-5 w-5" />, key: "health", screenshot: "health" },
    { icon: <Dumbbell className="h-5 w-5" />, key: "gym", screenshot: "gym" },
    { icon: <Bot className="h-5 w-5" />, key: "ai", screenshot: "ai-chat" },
    { icon: <Sun className="h-5 w-5" />, key: "myday", screenshot: "my-day" },
    { icon: <UtensilsCrossed className="h-5 w-5" />, key: "food", screenshot: "food" },
    { icon: <ShoppingCart className="h-5 w-5" />, key: "list", screenshot: "list" },
    { icon: <BarChart3 className="h-5 w-5" />, key: "trading", screenshot: "trading" },
    { icon: <FileText className="h-5 w-5" />, key: "reporting", screenshot: "reporting" },
    { icon: <Activity className="h-5 w-5" />, key: "dashboard", screenshot: "dashboard" },
  ] as const;

  const badges = [
    { icon: <Github className="h-3.5 w-3.5" />, label: t("badge_open_source") },
    { icon: <Server className="h-3.5 w-3.5" />, label: t("badge_self_hosted") },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: t("badge_privacy") },
  ];

  return (
    <div className="min-h-screen bg-[#26282B] text-white selection:bg-[#FFC700]/20">
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        {/* Gradient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#FFC700]/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-lg shadow-black/20">
            <span className="text-3xl font-bold bg-gradient-to-br from-[#FFC700] to-[#FFA800] bg-clip-text text-transparent">
              PD
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>

          <p className="mb-8 text-lg text-[#9a9ea6] sm:text-xl">
            {t("subtitle")}
          </p>

          {/* Badges */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            {badges.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#FFC700]/20 bg-[#FFC700]/[0.06] px-4 py-1.5 text-sm font-medium text-[#FFC700]"
              >
                {b.icon}
                {b.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://github.com/tarascloud/personal-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFC700] to-[#FFA800] px-6 py-3 text-sm font-semibold text-[#26282B] shadow-lg shadow-[#FFC700]/20 transition-all hover:shadow-[#FFC700]/30 hover:brightness-110"
            >
              <Github className="h-4 w-4" />
              {t("get_started")}
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="https://pd.taras.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.06]"
            >
              <ExternalLink className="h-4 w-4" />
              {t("live_demo")}
            </a>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("features_title")}
            </h2>
            <p className="text-[#9a9ea6]">
              {t("features_subtitle")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard
                key={f.key}
                icon={f.icon}
                title={t(`feature_${f.key}_title`)}
                desc={t(f.key === "ai" ? "feature_ai_desc_about" : `feature_${f.key}_desc`)}
                screenshot={f.screenshot}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== INTEGRATIONS ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
            {t("integrations_title")}
          </h2>
          <p className="mb-8 text-[#9a9ea6]">
            {t("integrations_subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <IntBadge name="Garmin Connect" />
            <IntBadge name="Monobank" />
            <IntBadge name="bunq" />
            <IntBadge name="Interactive Brokers" />
            <IntBadge name="Trading 212" />
            <IntBadge name="eToro" />
            <IntBadge name="Freqtrade" />
            <IntBadge name="Withings" />
            <IntBadge name="Telegram Bot" />
            <IntBadge name="Kraken" />
            <IntBadge name="Binance" />
            <IntBadge name="Cobee" />
            <IntBadge name="DPS (UA Tax)" />
          </div>
        </div>
      </section>

      {/* ==================== TECH STACK ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("tech_title")}
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Frontend */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#FFC700]">
                Frontend
              </h3>
              <div className="flex flex-col gap-2">
                <TechBadge icon={<Zap className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Next.js 16" />
                <TechBadge icon={<Zap className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="React 19" />
                <TechBadge icon={<Zap className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="TypeScript 5" />
                <TechBadge icon={<Zap className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Tailwind CSS 4" />
                <TechBadge icon={<Smartphone className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="PWA (Serwist)" />
              </div>
            </div>

            {/* Backend */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#FFC700]">
                Backend
              </h3>
              <div className="flex flex-col gap-2">
                <TechBadge icon={<Database className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="PostgreSQL" />
                <TechBadge icon={<Database className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Prisma 7" />
                <TechBadge icon={<Zap className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Python Scheduler" />
                <TechBadge icon={<Database className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Redis" />
                <TechBadge icon={<Database className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="PgBouncer" />
              </div>
            </div>

            {/* AI */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#FFC700]">
                AI
              </h3>
              <div className="flex flex-col gap-2">
                <TechBadge icon={<Brain className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Ollama (local)" />
                <TechBadge icon={<Brain className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Gemini 2.5" />
                <TechBadge icon={<Brain className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Groq" />
                <TechBadge icon={<Database className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="pgvector" />
                <TechBadge icon={<Brain className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Vercel AI SDK" />
              </div>
            </div>

            {/* Infra */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#FFC700]">
                Infrastructure
              </h3>
              <div className="flex flex-col gap-2">
                <TechBadge icon={<Server className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Docker" />
                <TechBadge icon={<Globe className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="3 Languages" />
                <TechBadge icon={<Lock className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="NextAuth 5" />
                <TechBadge icon={<Lock className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Infisical" />
                <TechBadge icon={<Calculator className="h-3.5 w-3.5 text-[#FFC700]/60" />} name="Playwright + Vitest" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PWA BANNER ==================== */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFC700]/10">
              <Smartphone className="h-6 w-6 text-[#FFC700]" />
            </div>
            <div>
              <h3 className="mb-1 text-base font-semibold text-white sm:text-lg">
                {t("pwa_title")}
              </h3>
              <p className="text-sm text-[#9a9ea6]">
                {t("pwa_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== SELF-HOSTED ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[#FFC700]/20 bg-gradient-to-br from-[#FFC700]/[0.04] to-transparent p-8 sm:p-12">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFC700]/10">
              <Server className="h-7 w-7 text-[#FFC700]" />
            </div>

            <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
              {t("selfhosted_title")}
            </h2>

            <div className="space-y-4 text-[#9a9ea6]">
              {(["selfhosted_1", "selfhosted_2", "selfhosted_3", "selfhosted_4"] as const).map((key) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFC700]/10">
                    <ChevronRight className="h-3 w-3 text-[#FFC700]" />
                  </div>
                  <p className="text-sm leading-relaxed">{t(key)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/[0.06] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/tarascloud/personal-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#9a9ea6] transition-colors hover:text-white"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <span className="text-white/20">|</span>
            <span className="text-sm text-[#9a9ea6]">AGPL-3.0</span>
            <span className="text-white/20">|</span>
            <a
              href="https://taras.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#9a9ea6] transition-colors hover:text-white"
            >
              taras.cloud
            </a>
          </div>
          <p className="text-xs text-[#9a9ea6]/60">
            {t("footer_made_by")}
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { enterDemoMode } from "@/actions/demo";
import {
  Wallet,
  Heart,
  Dumbbell,
  TrendingUp,
  Bot,
  BarChart3,
  Shield,
  Server,
  Github,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LanguageToggle } from "@/components/shared/language-toggle";

type FreeSpotsData = {
  remaining: number;
  total: number;
  max: number;
};

const FEATURES = [
  { key: "finance", icon: Wallet },
  { key: "health", icon: Heart },
  { key: "gym", icon: Dumbbell },
  { key: "investments", icon: TrendingUp },
  { key: "ai", icon: Bot },
  { key: "trading", icon: BarChart3 },
  { key: "tax", icon: Shield },
  { key: "dashboard", icon: BarChart3 },
  { key: "shopping", icon: Wallet },
];

const SCREENSHOTS = [
  { key: "dashboard", src: "/screenshots/dashboard.png" },
  { key: "finance", src: "/screenshots/finance.png" },
  { key: "gym", src: "/screenshots/gym.png" },
];

export function LandingPage({ freeSpots, githubEnabled }: { freeSpots: FreeSpotsData; githubEnabled: boolean }) {
  const t = useTranslations("landing");
  const [carouselIndex, setCarouselIndex] = useState(0);

  const prevSlide = () =>
    setCarouselIndex((i) => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
  const nextSlide = () =>
    setCarouselIndex((i) => (i + 1) % SCREENSHOTS.length);

  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] font-[Inter]">
      {/* -- Navigation -- */}
      <nav className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/PD.png" alt="PD" width={32} height={32} />
            <span className="text-lg font-bold text-[var(--landing-accent)]">Personal Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <a
              href="/login"
              className="text-sm font-medium text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors"
            >
              {t("sign_in")}
            </a>
            <form action={enterDemoMode} className="inline">
              <button
                type="submit"
                className="rounded-[6px] bg-[var(--landing-accent)] px-4 py-2 text-sm font-semibold text-[var(--landing-accent-dark)] transition-all hover:bg-[var(--landing-accent-bright)] hover:shadow-lg hover:shadow-[var(--landing-glow)]"
              >
                {t("try_demo")}
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* -- Hero -- */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[var(--landing-orb-primary)] blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-[var(--landing-orb-secondary)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-[var(--landing-accent)] via-[var(--landing-accent-bright)] to-[var(--landing-accent-deep)] bg-clip-text text-transparent">
              {t("hero_title")}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--landing-text-muted)] sm:text-xl">
            {t("hero_subtitle")}
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <form action={enterDemoMode}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--landing-accent)] px-8 py-3.5 text-base font-semibold text-[var(--landing-accent-dark)] shadow-lg shadow-[var(--landing-glow)] transition-all hover:bg-[var(--landing-accent-bright)] hover:shadow-xl hover:shadow-[var(--landing-glow-strong)]"
              >
                {t("try_demo")}
              </button>
            </form>
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--landing-border)] px-8 py-3.5 text-base font-semibold text-[var(--landing-text)] transition-all hover:bg-[var(--landing-surface)] hover:border-[var(--landing-border-hover)]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t("sign_in_google")}
            </button>
            {githubEnabled && (
              <button
                onClick={() => signIn("github", { callbackUrl: "/" })}
                className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--landing-border)] px-8 py-3.5 text-base font-semibold text-[var(--landing-text)] transition-all hover:bg-[var(--landing-surface)] hover:border-[var(--landing-border-hover)]"
              >
                <Github className="h-5 w-5" />
                {t("sign_in_github")}
              </button>
            )}
          </div>
          {freeSpots.remaining > 0 && (
            <p className="mt-4 text-sm text-[var(--landing-accent)]">
              {t("spots_left", { count: freeSpots.remaining, max: freeSpots.max })}
            </p>
          )}

          {freeSpots.remaining === 0 && (
            <p className="mt-4 text-sm text-[var(--landing-text-muted)]">
              {t("spots_full")}
            </p>
          )}
        </div>
      </section>

      {/* -- Feature Cards -- */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-3xl font-bold sm:text-4xl">
            {t("features_title")}
          </h2>
          <p className="mb-12 text-center text-[var(--landing-text-muted)]">
            {t("features_subtitle")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.key}
                  className="group rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 transition-all hover:border-[var(--landing-border-hover)] hover:shadow-lg hover:shadow-[var(--landing-orb-secondary)]"
                >
                  <div className="mb-4 inline-flex rounded-[6px] bg-[var(--landing-accent)]/10 p-3">
                    <Icon className="h-6 w-6 text-[var(--landing-accent)]" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-[var(--landing-text)]">
                    {t(`feature_${f.key}_title`)}
                  </h3>
                  <p className="text-sm text-[var(--landing-text-muted)] leading-relaxed">
                    {t(`feature_${f.key}_desc`)}
                  </p>
                </div>
              );
            })}
            {/* Food Tracking - Coming Soon */}
            <div className="group rounded-[6px] border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)]/50 p-6 opacity-60">
              <div className="mb-4 inline-flex rounded-[6px] bg-[rgba(255,255,255,0.05)] p-3">
                <Heart className="h-6 w-6 text-[var(--landing-text-subtle)]" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--landing-text-mid)]">
                {t("feature_food_title")}
              </h3>
              <p className="text-sm text-[var(--landing-text-dimmed)] leading-relaxed">
                {t("feature_food_desc")}
              </p>
              <span className="mt-3 inline-block rounded-full bg-[var(--landing-accent)]/10 px-3 py-1 text-xs font-medium text-[var(--landing-accent)]">
                Coming soon
              </span>
            </div>
          </div>

          {/* Connects to your services */}
          <div className="mt-16 text-center">
            <h3 className="mb-2 text-2xl font-bold sm:text-3xl">
              {t("integrations_title")}
            </h3>
            <p className="mx-auto mb-8 max-w-2xl text-[var(--landing-text-muted)]">
              {t("integrations_subtitle")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Garmin", "Withings", "Monobank", "bunq", "IBKR", "Trading 212", "eToro", "Freqtrade", "Telegram", "Ollama"].map((s) => (
                <span key={s} className="rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2 text-sm text-[var(--landing-text-soft)]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- Screenshots Carousel -- */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 bg-[var(--landing-bg-alt)]">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
            {t("screenshots_title")}
          </h2>
          <div className="relative">
            <div className="overflow-hidden rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-xl">
              <div className="relative aspect-[16/10] w-full bg-[var(--landing-bg-alt)] flex items-center justify-center">
                <img
                  src={SCREENSHOTS[carouselIndex].src}
                  alt={t(`screenshot_${SCREENSHOTS[carouselIndex].key}`)}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.classList.add("screenshot-placeholder");
                  }}
                />
                {/* Placeholder text shown when image fails to load */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--landing-text-muted)] screenshot-placeholder-text hidden">
                  <BarChart3 className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium opacity-50">
                    {t(`screenshot_${SCREENSHOTS[carouselIndex].key}`)}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)]/90 p-2 shadow-md backdrop-blur transition-all hover:bg-[var(--landing-surface)]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)]/90 p-2 shadow-md backdrop-blur transition-all hover:bg-[var(--landing-surface)]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="mt-4 flex justify-center gap-2">
              {SCREENSHOTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === carouselIndex
                      ? "w-8 bg-[var(--landing-accent)]"
                      : "w-2 bg-[var(--landing-text-faint)] hover:bg-[var(--landing-text-faint-hover)]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- Privacy Section -- */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex rounded-[6px] bg-[var(--landing-accent)]/10 p-4">
            <Shield className="h-10 w-10 text-[var(--landing-accent)]" />
          </div>
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            {t("privacy_title")}
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-[var(--landing-text-muted)]">
            {t("privacy_subtitle")}
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
              <Server className="mx-auto mb-3 h-8 w-8 text-[var(--landing-accent)]" />
              <h3 className="mb-2 font-semibold">{t("privacy_self_hosted")}</h3>
              <p className="text-sm text-[var(--landing-text-muted)]">
                {t("privacy_self_hosted_desc")}
              </p>
            </div>
            <div className="rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
              <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--landing-accent)]" />
              <h3 className="mb-2 font-semibold">{t("privacy_encrypted")}</h3>
              <p className="text-sm text-[var(--landing-text-muted)]">
                {t("privacy_encrypted_desc")}
              </p>
            </div>
            <div className="rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
              <Github className="mx-auto mb-3 h-8 w-8 text-[var(--landing-accent)]" />
              <h3 className="mb-2 font-semibold">{t("privacy_open_source")}</h3>
              <p className="text-sm text-[var(--landing-text-muted)]">
                {t("privacy_open_source_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -- Open Source CTA -- */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 bg-[var(--landing-bg-alt)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex rounded-[6px] bg-[var(--landing-surface)] p-4 border border-[var(--landing-border)]">
            <Github className="h-10 w-10 text-[var(--landing-text)]" />
          </div>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            {t("open_source_title")}
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-[var(--landing-text-muted)]">
            {t("open_source_desc")}
          </p>
          <a
            href="https://github.com/tarascloud/personal-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-[6px] border border-[var(--landing-border)] bg-[var(--landing-surface)] px-8 py-3.5 text-base font-semibold text-[var(--landing-text)] transition-all hover:border-[var(--landing-border-hover)] hover:bg-[var(--landing-surface-hover)]"
          >
            <Github className="h-5 w-5" />
            {t("open_source_cta")}
          </a>
        </div>
      </section>

      {/* -- Footer -- */}
      <footer className="border-t border-[var(--landing-border)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/PD.png" alt="PD" width={24} height={24} />
            <span className="text-sm text-[var(--landing-text-muted)]">
              Personal Dashboard
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--landing-text-muted)]">
            <a
              href="https://github.com/tarascloud/personal-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--landing-accent)] transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a href="/about" className="hover:text-[var(--landing-accent)] transition-colors">
              {t("about")}
            </a>
            <a
              href="/about#privacy"
              className="hover:text-[var(--landing-accent)] transition-colors"
            >
              {t("privacy")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getUserPreference, setUserPreference } from "@/actions/settings";

const PREF_KEY = "first_session_tour_done";

type Step = {
  id: string;
  /** Target selector via [data-tour="<id>"]. If absent, the step shows centered without spotlight. */
  selector?: string;
};

const STEPS: Step[] = [
  { id: "nav", selector: "[data-tour='nav']" },
  { id: "dashboard", selector: "[data-tour='dashboard']" },
  { id: "my_day", selector: "[data-tour='my-day']" },
  { id: "settings", selector: "[data-tour='settings']" },
];

type Rect = { top: number; left: number; width: number; height: number };

export function FirstSessionTour() {
  const t = useTranslations("first_session_tour");
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cancelledRef = useRef(false);

  // 1. On mount: decide whether to show
  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      try {
        const done = await getUserPreference(PREF_KEY);
        if (!done && !cancelledRef.current) setActive(true);
      } catch {
        // ignore — never block UI on preference fetch
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // 2. Locate current step's target rect; reposition on scroll/resize
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    function update() {
      if (!step?.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, { capture: true } as EventListenerOptions);
    };
  }, [active, stepIdx]);

  const finish = useCallback(async () => {
    setActive(false);
    try {
      await setUserPreference(PREF_KEY, "1");
    } catch {
      // ignore — silent failure means tour shows once more, not the end of the world
    }
  }, []);

  const next = useCallback(() => {
    setStepIdx(i => {
      if (i + 1 >= STEPS.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // 3. ESC closes the tour
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") skip();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, skip]);

  if (!active) return null;

  const step = STEPS[stepIdx];
  const padding = 8;
  const spotlight = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  // Tooltip placement: below the target if the target's bottom + 200px fits
  // in the viewport; otherwise above. If no spotlight, center the tooltip.
  const tooltipStyle: React.CSSProperties = (() => {
    if (!spotlight) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "min(420px, 92vw)",
      };
    }
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const placeBelow = spotlight.top + spotlight.height + 220 < vh;
    const top = placeBelow
      ? spotlight.top + spotlight.height + 12
      : Math.max(16, spotlight.top - 220);
    const left = Math.max(16, Math.min(spotlight.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 420 - 16));
    return { top, left, maxWidth: "min(420px, 92vw)" };
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aria_label")}
      className="fixed inset-0 z-[100] pointer-events-none"
    >
      {/* Backdrop. SVG mask cuts a hole around the spotlight rect. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ pointerEvents: "auto" }}
        onClick={skip}
      >
        <defs>
          {/* NOTE: white/black inside <mask> are SVG luminance values
              (white = visible, black = cut-out hole), NOT theme colors —
              do not replace them with theme tokens. */}
          <mask id="first-session-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#first-session-tour-mask)"
        />
        {spotlight && (
          <rect
            x={spotlight.left}
            y={spotlight.top}
            width={spotlight.width}
            height={spotlight.height}
            rx={8}
            ry={8}
            fill="none"
            stroke="var(--ring)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        className="absolute pointer-events-auto bg-card border border-border rounded-lg shadow-xl p-4 sm:p-5"
        style={tooltipStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-sm sm:text-base font-semibold leading-tight">
            {t(`step_${step.id}.title`)}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">
            {stepIdx + 1} / {STEPS.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`step_${step.id}.body`)}
        </p>
        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={skip}>
            {t("skip")}
          </Button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              >
                {t("back")}
              </Button>
            )}
            <Button size="sm" onClick={next} autoFocus>
              {stepIdx + 1 < STEPS.length ? t("next") : t("done")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

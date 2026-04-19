// Recharts 3.8 + React 18/19 concurrent mode emits `width(-1) and height(-1)`
// console.warn on initial ResponsiveContainer mount (before useLayoutEffect
// measures the parent). The charts render correctly once ResizeObserver fires,
// so the warning is cosmetic — but it drowns real warnings in console noise.
// Pattern-matched suppression keeps the rest of Recharts' diagnostics intact.

let installed = false;

export function installRechartsWarningSuppressor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("The width(-1) and height(-1) of chart")) {
      return;
    }
    origWarn(...args);
  };
}

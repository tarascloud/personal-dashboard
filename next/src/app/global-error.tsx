"use client";

import { useEffect } from "react";

// DEV-20260507-0074: Root-level error boundary. Required by Next.js to catch
// errors thrown above the (dashboard) segment. Same stale-Server-Action
// auto-recovery as dashboard error.tsx, but with a barebones HTML shell because
// global-error replaces the entire RootLayout when it renders.

const STALE_ACTION_PATTERN = /Failed to find Server Action/i;
const RELOAD_FLAG_KEY = "pd:stale-action-reloaded";

function isStaleServerActionError(err: Error): boolean {
  return (
    STALE_ACTION_PATTERN.test(err.message || "") ||
    STALE_ACTION_PATTERN.test((err as Error & { stack?: string }).stack || "")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);

    if (typeof window !== "undefined" && isStaleServerActionError(error)) {
      try {
        if (sessionStorage.getItem(RELOAD_FLAG_KEY) !== "1") {
          sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
          window.setTimeout(() => window.location.reload(), 150);
        }
      } catch {
        window.setTimeout(() => window.location.reload(), 150);
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "1.5rem",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p
            style={{
              opacity: 0.75,
              marginBottom: "1.5rem",
              fontSize: "0.95rem",
            }}
          >
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 6,
              border: "1px solid #525252",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

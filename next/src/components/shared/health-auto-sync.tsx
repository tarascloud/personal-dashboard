"use client";

import { useEffect, useRef } from "react";

export function HealthAutoSync() {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    fetch("/api/sync/health", { method: "POST" }).catch(() => {
      // Silently ignore — non-critical background sync
    });
  }, []);

  return null;
}

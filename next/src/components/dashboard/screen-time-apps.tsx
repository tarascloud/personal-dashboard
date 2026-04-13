"use client";

import type { ScreenTimeAppEntry } from "@/actions/dashboard";

interface ScreenTimeAppsProps {
  apps: ScreenTimeAppEntry[];
  totalMinutes: number;
}

export function ScreenTimeApps({ apps, totalMinutes }: ScreenTimeAppsProps) {
  const maxMinutes = Math.max(...apps.map((a) => a.minutes), 1);

  return (
    <div className="space-y-2">
      {apps.map((app) => {
        const pct = Math.round((app.minutes / totalMinutes) * 100);
        const barPct = Math.round((app.minutes / maxMinutes) * 100);
        const h = Math.floor(app.minutes / 60);
        const m = app.minutes % 60;
        const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;

        return (
          <div key={app.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-medium">
              {app.name}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
              {duration} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { Card, cn } from "../ui";
import type { Config } from "../types";

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function DemoDataStep({ config, setConfig }: Props) {
  return (
    <Card title="Demo Data" subtitle="Optionally seed your database with sample data to explore features immediately.">
      <label
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
          config.seedDemo ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
        )}
      >
        <input type="checkbox" checked={config.seedDemo} onChange={(e) => setConfig((p) => ({ ...p, seedDemo: e.target.checked }))} className="sr-only" />
        <div className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
          config.seedDemo ? "border-accent bg-accent" : "border-border"
        )}>
          {config.seedDemo && <Check size={12} className="text-bg" />}
        </div>
        <div>
          <span className="font-medium text-sm">Seed demo data for quick start</span>
          <span className="ml-2 text-xs text-accent">Recommended</span>
          <p className="text-text-muted text-xs mt-1">Adds 50 transactions, 30 days of health data, and 20 workouts so you can explore right away.</p>
        </div>
      </label>
    </Card>
  );
}

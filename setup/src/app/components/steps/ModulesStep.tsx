"use client";

import { Check } from "lucide-react";
import { Card, cn } from "../ui";
import { MODULES } from "../constants";
import type { Config } from "../types";

interface Props {
  config: Config;
  toggleModule: (id: string) => void;
}

export function ModulesStep({ config, toggleModule }: Props) {
  return (
    <Card title="Select Modules" subtitle="Choose which features to enable. You can change this later.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULES.map((mod) => {
          const active = config.modules.includes(mod.id);
          return (
            <label
              key={mod.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                active ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
              )}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleModule(mod.id)}
                className="sr-only"
              />
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                active ? "border-accent bg-accent" : "border-border"
              )}>
                {active && <Check size={12} className="text-bg" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("transition-colors", active ? "text-accent" : "text-text-muted")}>{mod.icon}</span>
                  <span className="font-medium text-sm">{mod.label}</span>
                </div>
                <p className="text-text-muted text-xs mt-1">{mod.desc}</p>
              </div>
            </label>
          );
        })}
      </div>
    </Card>
  );
}

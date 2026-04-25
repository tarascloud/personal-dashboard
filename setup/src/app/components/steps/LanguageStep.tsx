"use client";

import { Card, cn } from "../ui";
import { LANGUAGES } from "../constants";
import type { Config } from "../types";

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function LanguageStep({ config, setConfig }: Props) {
  return (
    <Card title="Choose Language" subtitle="Select the interface language for your dashboard">
      <div className="space-y-3">
        {LANGUAGES.map((lang) => (
          <label
            key={lang.value}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
              config.language === lang.value
                ? "border-accent bg-accent/10"
                : "border-border hover:border-text-muted"
            )}
          >
            <input
              type="radio"
              name="language"
              checked={config.language === lang.value}
              onChange={() => setConfig((p) => ({ ...p, language: lang.value }))}
              className="sr-only"
            />
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
              config.language === lang.value ? "border-accent" : "border-border"
            )}>
              {config.language === lang.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
            <span className="font-medium">{lang.label}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

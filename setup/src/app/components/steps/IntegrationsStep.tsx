"use client";

import { Card, PasswordInput } from "../ui";
import { INTEGRATIONS } from "../constants";
import type { Config } from "../types";

interface Props {
  config: Config;
  setIntegrationField: (integrationId: string, key: string, value: string) => void;
}

export function IntegrationsStep({ config, setIntegrationField }: Props) {
  const visibleIntegrations = INTEGRATIONS.filter((ig) =>
    ig.requiredModules.some((rm) => config.modules.includes(rm))
  );

  return (
    <Card title="Integrations" subtitle="Connect external services. All fields are optional — you can configure them later.">
      {visibleIntegrations.length === 0 ? (
        <p className="text-text-muted text-sm">No integrations needed for your selected modules.</p>
      ) : (
        <div className="space-y-6">
          {visibleIntegrations.map((ig) => (
            <div key={ig.id} className="border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-1">{ig.label}</h3>
              <p className="text-text-muted text-xs mb-3">{ig.description}</p>
              <div className="space-y-3">
                {ig.fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-text-muted mb-1 block">{field.label}</label>
                    {field.type === "password" ? (
                      <PasswordInput
                        value={config.integrations[ig.id]?.[field.key] || ""}
                        onChange={(v) => setIntegrationField(ig.id, field.key, v)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type="text"
                        value={config.integrations[ig.id]?.[field.key] || ""}
                        onChange={(e) => setIntegrationField(ig.id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-text-muted text-xs mt-2 italic">Skip for now — you can add this later in Settings.</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

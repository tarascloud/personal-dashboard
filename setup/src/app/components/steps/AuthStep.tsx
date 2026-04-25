"use client";

import { ExternalLink } from "lucide-react";
import { Card, PasswordInput, cn } from "../ui";
import type { AuthMode, Config } from "../types";

interface Props {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export function AuthStep({ config, setConfig }: Props) {
  const authOptions: { value: AuthMode; label: string; badge?: string; desc: string; helpUrl?: string }[] = [
    { value: "google", label: "Google OAuth", badge: "Recommended", desc: "Login with your Google account. Requires Client ID and Secret from console.cloud.google.com", helpUrl: "https://console.cloud.google.com/apis/credentials" },
    { value: "github", label: "GitHub OAuth", desc: "Login with your GitHub account. Create an OAuth App at github.com/settings/developers", helpUrl: "https://github.com/settings/developers" },
    { value: "demo", label: "Demo Mode", desc: "No authentication required. Best for testing and local use." },
  ];

  return (
    <Card title="Authentication" subtitle="How will you log in to your dashboard?">
      <div className="space-y-3">
        {authOptions.map((opt) => (
          <div key={opt.value}>
            <label
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                config.auth === opt.value ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                config.auth === opt.value ? "border-accent" : "border-border"
              )}>
                {config.auth === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
              </div>
              <div className="flex-1" onClick={() => setConfig((p) => ({ ...p, auth: opt.value }))}>
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.badge && <span className="ml-2 text-xs text-accent">{opt.badge}</span>}
                <p className="text-text-muted text-xs mt-1">{opt.desc}</p>
              </div>
            </label>

            {config.auth === "google" && opt.value === "google" && (
              <div className="ml-8 space-y-3 py-2">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Google Client ID</label>
                  <input
                    type="text"
                    value={config.googleClientId}
                    onChange={(e) => setConfig((p) => ({ ...p, googleClientId: e.target.value }))}
                    placeholder="123456789.apps.googleusercontent.com"
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Google Client Secret</label>
                  <PasswordInput
                    value={config.googleClientSecret}
                    onChange={(v) => setConfig((p) => ({ ...p, googleClientSecret: v }))}
                    placeholder="GOCSPX-..."
                  />
                </div>
                <a href={opt.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  Get credentials <ExternalLink size={12} />
                </a>
              </div>
            )}

            {config.auth === "github" && opt.value === "github" && (
              <div className="ml-8 space-y-3 py-2">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">GitHub Client ID</label>
                  <input
                    type="text"
                    value={config.githubClientId}
                    onChange={(e) => setConfig((p) => ({ ...p, githubClientId: e.target.value }))}
                    placeholder="Ov23li..."
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">GitHub Client Secret</label>
                  <PasswordInput
                    value={config.githubClientSecret}
                    onChange={(v) => setConfig((p) => ({ ...p, githubClientSecret: v }))}
                    placeholder="secret..."
                  />
                </div>
                <div className="bg-bg-input rounded-lg p-3 text-xs text-text-muted space-y-1">
                  <p className="font-medium text-text">Callback URL for your OAuth App:</p>
                  <code className="text-accent bg-bg border border-border rounded px-2 py-1 block">http://localhost:3333/api/auth/callback/github</code>
                </div>
                <a href={opt.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  Create OAuth App <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

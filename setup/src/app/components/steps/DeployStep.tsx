"use client";

import { ExternalLink, Loader2, Rocket } from "lucide-react";
import { Card, ContainerStatusPanel, DeployLogViewer, cn } from "../ui";
import { LANGUAGES, MODULES } from "../constants";
import type { Config } from "../types";

interface Props {
  config: Config;
  deploying: boolean;
  deployLog: string[];
  deployDone: boolean;
  onDeploy: () => void;
}

export function DeployStep({ config, deploying, deployLog, deployDone, onDeploy }: Props) {
  const selectedModules = MODULES.filter((m) => config.modules.includes(m.id));
  const containers = [
    { name: "pd-app", desc: "Next.js Dashboard", always: true },
    { name: "pg", desc: "PostgreSQL", always: true },
    { name: "redis", desc: "Redis Cache", always: true },
    { name: "ollama", desc: "Local AI (Ollama)", always: false, condition: config.integrations.ai_provider?.AI_PROVIDER === "ollama" },
    { name: "freqtrade", desc: "Trading Bot", always: false, condition: config.modules.includes("trading") },
  ].filter((c) => c.always || c.condition);

  const hasErrors = deployLog.some((l) => l.startsWith("ERROR"));
  const autoDeployed = deployLog.some((l) => l.includes("Starting containers") || l.includes("Deployment complete"));
  const manualMode = deployLog.some((l) => l.includes("Docker socket not available"));

  if (deployDone) {
    return (
      <Card title={hasErrors ? "Deployment Issues" : "Setup Complete!"} subtitle={hasErrors ? "There were some issues during deployment." : "Your Personal Dashboard is deployed and running."}>
        <DeployLogViewer log={deployLog} defaultOpen={hasErrors} />
        {autoDeployed && !hasErrors && <ContainerStatusPanel />}
        <div className="text-center space-y-4 mt-6">
          {manualMode ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Configuration files saved to <code className="text-accent bg-bg-input px-1.5 py-0.5 rounded text-xs">/data/</code>
              </p>
              <div className="bg-bg-input rounded-lg p-4 text-left">
                <p className="text-xs text-text-muted mb-2">To deploy, run these commands:</p>
                <div className="space-y-1 font-mono text-xs">
                  <p className="text-accent">cd /data</p>
                  <p className="text-accent">docker compose up -d</p>
                  <p className="text-accent">docker exec pd-app npx prisma migrate deploy</p>
                  {config.seedDemo && <p className="text-accent">docker exec -i pg psql -U pd pd_prod &lt; seed-demo-data.sql</p>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Your dashboard is running. It may take a few seconds to fully start.
            </p>
          )}

          <a
            href="http://localhost:3333"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Open Dashboard <ExternalLink size={16} />
          </a>

          <p className="text-xs text-text-muted">
            Dashboard URL: <code className="text-accent">http://localhost:3333</code>
          </p>
        </div>
      </Card>
    );
  }

  if (deploying) {
    const stepLines = deployLog.filter((l) => l.match(/^\[\d+\/\d+\]/));
    const lastStep = stepLines.length > 0 ? stepLines[stepLines.length - 1] : "";
    const match = lastStep.match(/^\[(\d+)\/(\d+)\]/);
    const progressPct = match ? Math.min(95, (parseInt(match[1]) / parseInt(match[2])) * 100) : Math.min(95, deployLog.length * 8);

    return (
      <Card title="Deploying..." subtitle="Setting up your Personal Dashboard">
        <div className="space-y-4">
          <div className="w-full bg-bg-input rounded-full h-2 overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="bg-bg-input rounded-lg p-4 max-h-72 overflow-y-auto font-mono text-xs text-text-muted space-y-1" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {deployLog.map((line, i) => (
              <div key={i} className={cn(
                line.startsWith("ERROR") && "text-error",
                line.startsWith("WARNING") && "text-yellow-400",
                /^\[\d+\/\d+\]/.test(line) && "text-text font-semibold",
              )}>
                {line}
              </div>
            ))}
            <div className="flex items-center gap-2 text-accent">
              <Loader2 size={12} className="animate-spin" /> Working...
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Review & Deploy" subtitle="Review your configuration before deploying.">
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Language</h3>
          <p className="text-sm">{LANGUAGES.find((l) => l.value === config.language)?.label}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Modules ({selectedModules.length})</h3>
          <div className="flex flex-wrap gap-2">
            {selectedModules.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 bg-accent/10 text-accent border border-accent/30 rounded-full px-3 py-1 text-xs font-medium">
                {m.icon} {m.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Authentication</h3>
          <p className="text-sm">{config.auth === "google" ? "Google OAuth" : config.auth === "github" ? "GitHub OAuth" : "Demo Mode (no auth)"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Demo Data</h3>
          <p className="text-sm">{config.seedDemo ? "Yes — seed sample data" : "No — empty start"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Docker Containers</h3>
          <div className="space-y-1">
            {containers.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-success" />
                <code className="text-accent text-xs">{c.name}</code>
                <span className="text-text-muted text-xs">-- {c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-input rounded-lg p-3 text-xs text-text-muted">
          <p>Clicking <strong className="text-text">Deploy Now</strong> will:</p>
          <ol className="list-decimal ml-4 mt-2 space-y-1">
            <li>Generate .env and docker-compose.yml</li>
            <li>Start all containers via Docker</li>
            <li>Run database migrations</li>
            {config.seedDemo && <li>Seed demo data (transactions, workouts, health)</li>}
          </ol>
        </div>

        <button
          onClick={onDeploy}
          className="w-full bg-accent hover:bg-accent-hover text-bg font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Rocket size={18} /> Deploy Now
        </button>
      </div>
    </Card>
  );
}

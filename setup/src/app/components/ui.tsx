"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, Check, Eye, EyeOff, Loader2, CircleCheck, CircleAlert } from "lucide-react";

export function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function getSetupToken(): string | null {
  if (typeof window === "undefined") return null;
  let tok = window.localStorage.getItem("pd-setup-token");
  if (!tok) {
    tok = window.prompt(
      "Enter SETUP_TOKEN (see container logs: `docker logs pd-setup` or SETUP_TOKEN env var):",
    );
    if (tok) window.localStorage.setItem("pd-setup-token", tok.trim());
  }
  return tok ? tok.trim() : null;
}

export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
              i < step && "bg-accent text-bg",
              i === step && "bg-accent text-bg ring-2 ring-accent/40 ring-offset-2 ring-offset-bg",
              i > step && "bg-bg-card text-text-muted border border-border"
            )}
          >
            {i < step ? <Check size={16} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn(
              "hidden sm:block w-8 md:w-12 h-0.5 mx-1 transition-colors duration-300",
              i < step ? "bg-accent" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Card({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-6 sm:p-8 w-full max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-1">{title}</h2>
      {subtitle && <p className="text-text-muted text-sm mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 pr-10 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function DeployLogViewer({ log, defaultOpen }: { log: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-muted hover:text-text flex items-center gap-1 mb-2"
      >
        <ChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
        {open ? "Hide" : "Show"} deploy log ({log.length} lines)
      </button>
      {open && (
        <div className="bg-bg-input rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-xs text-text-muted space-y-1">
          {log.map((line, i) => (
            <div key={i} className={cn(
              line.startsWith("ERROR") && "text-error",
              line.startsWith("WARNING") && "text-yellow-400",
              line.startsWith("[done]") && "text-success font-semibold",
              /^\[\d+\/\d+\]/.test(line) && "text-text",
            )}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContainerStatusPanel() {
  const [containers, setContainers] = useState<{ name: string; status: string; health: string }[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();
        setContainers(data.containers || []);
      } catch {
        // ignore
      }
    };
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  if (containers.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Container Status</h3>
      <div className="space-y-2">
        {containers.map((c) => (
          <div key={c.name} className="flex items-center gap-2 text-sm">
            {c.health === "healthy" || c.health === "running" ? (
              <CircleCheck size={16} className="text-success flex-shrink-0" />
            ) : c.health === "starting" ? (
              <Loader2 size={16} className="text-accent animate-spin flex-shrink-0" />
            ) : (
              <CircleAlert size={16} className="text-error flex-shrink-0" />
            )}
            <code className="text-accent text-xs">{c.name}</code>
            <span className="text-text-muted text-xs">{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

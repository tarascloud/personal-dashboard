"use client";

import { useState, useCallback } from "react";
import type { Config } from "../components/types";
import { MODULES } from "../components/constants";
import { getSetupToken } from "../components/ui";

export function useSetupState() {
  const [step, setStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [deployDone, setDeployDone] = useState(false);

  const [config, setConfig] = useState<Config>({
    language: "en",
    modules: MODULES.filter((m) => m.defaultOn).map((m) => m.id),
    integrations: {},
    auth: "demo",
    googleClientId: "",
    googleClientSecret: "",
    githubClientId: "",
    githubClientSecret: "",
    seedDemo: true,
  });

  const toggleModule = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      modules: prev.modules.includes(id)
        ? prev.modules.filter((m) => m !== id)
        : [...prev.modules, id],
    }));
  }, []);

  const setIntegrationField = useCallback((integrationId: string, key: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [integrationId]: { ...prev.integrations[integrationId], [key]: value },
      },
    }));
  }, []);

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployLog([]);
    try {
      const token = getSetupToken();
      if (!token) {
        setDeployLog((prev) => [...prev, "ERROR: SETUP_TOKEN required"]);
        setDeploying(false);
        return;
      }
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-token": token,
        },
        body: JSON.stringify(config),
      });
      if (res.status === 401) {
        window.localStorage.removeItem("pd-setup-token");
        setDeployLog((prev) => [...prev, "ERROR: Invalid SETUP_TOKEN — reload page and try again"]);
        setDeploying(false);
        return;
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const text = decoder.decode(value);
          const lines = text.split("\n").filter(Boolean);
          setDeployLog((prev) => [...prev, ...lines]);
        }
      }
      setDeployDone(true);
    } catch (err) {
      setDeployLog((prev) => [...prev, `ERROR: ${err instanceof Error ? err.message : "Deploy failed"}`]);
    } finally {
      setDeploying(false);
    }
  }, [config]);

  const canNext = useCallback(() => {
    if (step === 0) return true;
    if (step === 1) return config.modules.length > 0;
    if (step === 3 && config.auth === "google") return config.googleClientId.length > 0 && config.googleClientSecret.length > 0;
    if (step === 3 && config.auth === "github") return config.githubClientId.length > 0 && config.githubClientSecret.length > 0;
    return true;
  }, [step, config]);

  return {
    step, setStep,
    config, setConfig,
    deploying, deployLog, deployDone,
    toggleModule, setIntegrationField,
    handleDeploy, canNext,
  };
}

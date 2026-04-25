import type { ReactNode } from "react";

export type Language = "en" | "uk" | "es";
export type AuthMode = "google" | "github" | "demo";

export interface Module {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  envFlag: string;
  defaultOn: boolean;
}

export interface IntegrationField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

export interface Integration {
  id: string;
  label: string;
  description: string;
  requiredModules: string[];
  fields: IntegrationField[];
}

export interface Config {
  language: Language;
  modules: string[];
  integrations: Record<string, Record<string, string>>;
  auth: AuthMode;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  seedDemo: boolean;
}

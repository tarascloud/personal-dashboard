import {
  Globe, LayoutGrid, Plug, Shield, Database, Rocket,
  Wallet, TrendingUp, Heart, Dumbbell, Sun, Utensils,
  ShoppingCart, MessageSquare, Sparkles, BarChart3, FileText,
} from "lucide-react";
import type { Integration, Language, Module } from "./types";

export const STEPS = [
  { label: "Language", icon: <Globe size={16} /> },
  { label: "Modules", icon: <LayoutGrid size={16} /> },
  { label: "Integrations", icon: <Plug size={16} /> },
  { label: "Auth", icon: <Shield size={16} /> },
  { label: "Demo Data", icon: <Database size={16} /> },
  { label: "Deploy", icon: <Rocket size={16} /> },
];

export const MODULES: Module[] = [
  { id: "finance", label: "Finance", desc: "Transactions, budgets, accounts, CSV import", icon: <Wallet size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_FINANCE", defaultOn: true },
  { id: "investments", label: "Investments", desc: "Portfolio, NAV, P&L, allocation", icon: <TrendingUp size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_INVESTMENTS", defaultOn: false },
  { id: "health", label: "Health", desc: "Garmin sync, sleep, HRV, Body Battery", icon: <Heart size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_HEALTH", defaultOn: true },
  { id: "gym", label: "Gym & Workouts", desc: "Exercises, programs, sets, PRs", icon: <Dumbbell size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_GYM", defaultOn: true },
  { id: "my_day", label: "My Day", desc: "Mood, energy, stress, journal", icon: <Sun size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_MY_DAY", defaultOn: true },
  { id: "food", label: "Food", desc: "Calories, protein, trends", icon: <Utensils size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_FOOD", defaultOn: false },
  { id: "shopping", label: "Shopping List", desc: "Shopping lists, quick expenses", icon: <ShoppingCart size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_SHOPPING", defaultOn: false },
  { id: "ai_chat", label: "AI Chat", desc: "Chat with your data (Gemini/Groq/Ollama)", icon: <MessageSquare size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_AI_CHAT", defaultOn: false },
  { id: "ai_insights", label: "AI Insights", desc: "Automatic analytical insights", icon: <Sparkles size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_AI_INSIGHTS", defaultOn: false },
  { id: "trading", label: "Trading", desc: "Freqtrade bot integration", icon: <BarChart3 size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_TRADING", defaultOn: false },
  { id: "reporting", label: "Tax Reporting", desc: "UA FOP / ES IRPF tax reports", icon: <FileText size={20} />, envFlag: "NEXT_PUBLIC_FEATURE_REPORTING", defaultOn: false },
];

export const INTEGRATIONS: Integration[] = [
  { id: "garmin", label: "Garmin Connect", description: "Sync health data from Garmin", requiredModules: ["health"], fields: [
    { key: "GARMIN_EMAIL", label: "Garmin Email", placeholder: "your@email.com" },
    { key: "GARMIN_PASSWORD", label: "Garmin Password", placeholder: "password", type: "password" },
  ]},
  { id: "monobank", label: "Monobank", description: "Sync bank transactions", requiredModules: ["finance"], fields: [
    { key: "MONOBANK_TOKEN", label: "API Token", placeholder: "Token from api.monobank.ua" },
  ]},
  { id: "ibkr", label: "Interactive Brokers", description: "Sync investment portfolio via Flex Query", requiredModules: ["investments"], fields: [
    { key: "IBKR_FLEX_TOKEN", label: "Flex Query Token", placeholder: "Flex Web Service token" },
    { key: "IBKR_ACCOUNT_ID", label: "Account ID", placeholder: "e.g. U1234567" },
  ]},
  { id: "trading212", label: "Trading 212", description: "Sync investment positions", requiredModules: ["investments"], fields: [
    { key: "TRADING212_API_KEY", label: "API Key", placeholder: "Trading 212 API key" },
  ]},
  { id: "ai_provider", label: "AI Provider", description: "Choose your AI backend", requiredModules: ["ai_chat", "ai_insights"], fields: [
    { key: "AI_PROVIDER", label: "Provider", placeholder: "ollama / gemini / groq" },
    { key: "GEMINI_API_KEY", label: "Gemini API Key (if Gemini)", placeholder: "API key from ai.google.dev" },
    { key: "GROQ_API_KEY", label: "Groq API Key (if Groq)", placeholder: "API key from groq.com" },
  ]},
  { id: "kraken", label: "Kraken Exchange", description: "API keys for Freqtrade trading", requiredModules: ["trading"], fields: [
    { key: "KRAKEN_API_KEY", label: "API Key", placeholder: "Kraken API key" },
    { key: "KRAKEN_API_SECRET", label: "API Secret", placeholder: "Kraken API secret", type: "password" },
  ]},
];

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "es", label: "Español" },
];

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  getSecret,
  setSecret,
  getUserPreference,
  setUserPreference,
} from "@/actions/settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  KeyIcon,
  LinkIcon,
  BookOpenIcon,
  MonitorSmartphoneIcon,
} from "lucide-react";
import { useDemoMode } from "@/hooks/use-demo-mode";

export default function ScreenTimeIntegrationPage() {
  const isDemo = useDemoMode();
  const t = useTranslations("settings");
  const [isPending, startTransition] = useTransition();

  const [apiToken, setApiToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [totalDays, setTotalDays] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const [token, syncTime] = await Promise.all([
        getSecret("screen_time_api_token"),
        getUserPreference("screen_time_last_sync"),
      ]);
      if (token) {
        setApiToken(token);
        setHasToken(true);
      }
      setLastSync(syncTime);

      try {
        const res = await fetch("/api/health/screen-time");
        if (res.ok) {
          const data = await res.json();
          setTotalDays(data.count ?? 0);
        }
      } catch {
        // not configured yet
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    setApiToken(token);
    setHasToken(false);
  }

  function handleSave() {
    if (!apiToken.trim()) return;
    startTransition(async () => {
      await setSecret("screen_time_api_token", apiToken.trim());
      await setUserPreference("screen_time_configured", "true");
      setHasToken(true);
      setSaved(true);
      toast.success("Token збережено");
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function handleCopyToken() {
    navigator.clipboard.writeText(apiToken);
    toast.success("Token скопійовано");
  }

  function handleCopyEndpoint() {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/health/screen-time`;
    navigator.clipboard.writeText(url);
    toast.success("URL скопійовано");
  }

  function handleCheckStatus() {
    setChecking(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/health/screen-time");
        if (res.ok) {
          const data = await res.json();
          setTotalDays(data.count ?? 0);
          if (data.count > 0 && data.data?.[0]?.date) {
            setLastSync(data.data[0].date);
          }
          toast.success(`Знайдено ${data.count} днів даних`);
        } else {
          toast.error("Не вдалося перевірити статус");
        }
      } catch {
        toast.error("Помилка з'єднання");
      } finally {
        setChecking(false);
      }
    });
  }

  const configured = hasToken && totalDays > 0;
  const step = !hasToken ? 1 : totalDays === 0 ? 2 : 3;

  return (
    <div className="space-y-6">
      {isDemo && (
        <p className="text-xs text-muted-foreground">Read-only in demo mode</p>
      )}

      {/* Hero header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl shadow-md">
          📱
        </div>
        <div>
          <h2 className="text-lg font-semibold">Apple Screen Time</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Синхронізуй дані Screen Time з iPhone у свій дашборд.
            Відстежуй час використання, категорії додатків та кількість розблокувань.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {configured ? (
          <Badge variant="default" className="bg-green-600 text-white px-3 py-1">
            <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" />
            Підключено — {totalDays} {totalDays === 1 ? "день" : totalDays < 5 ? "дні" : "днів"}
          </Badge>
        ) : hasToken ? (
          <Badge variant="secondary" className="px-3 py-1">
            <MonitorSmartphoneIcon className="mr-1.5 h-3.5 w-3.5" />
            Очікування даних з iPhone
          </Badge>
        ) : (
          <Badge variant="outline" className="px-3 py-1">
            <AlertCircleIcon className="mr-1.5 h-3.5 w-3.5" />
            Не налаштовано
          </Badge>
        )}
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Останні дані: {new Date(lastSync).toLocaleDateString("uk-UA")}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCheckStatus}
          disabled={isDemo || isPending || checking}
          className="ml-auto"
        >
          <RefreshCwIcon className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Перевірка..." : "Оновити"}
        </Button>
      </div>

      {/* Setup steps */}
      <div className="space-y-4">
        {/* Step 1: Token */}
        <Card className={`p-5 space-y-4 transition-all ${step === 1 ? "ring-2 ring-blue-500/30" : ""}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step > 1 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
              {step > 1 ? "✓" : "1"}
            </div>
            <div className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Створити API Token</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Згенеруй token і збережи його. Цей token використовується для автентифікації запитів з iOS Shortcut.
          </p>
          <div className="ml-10 space-y-3">
            <div>
              <Label htmlFor="screen-time-token">Bearer Token</Label>
              <PasswordInput
                id="screen-time-token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                disabled={isDemo}
                placeholder="Натисни Generate щоб створити token"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateToken}
                disabled={isDemo}
              >
                <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
                Generate
              </Button>
              {apiToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  disabled={isDemo}
                >
                  <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isDemo || isPending || !apiToken.trim()}
              >
                {saved ? "Збережено ✓" : "Зберегти"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Step 2: iOS Shortcut */}
        <Card className={`p-5 space-y-4 transition-all ${step === 2 ? "ring-2 ring-blue-500/30" : ""}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step > 2 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : step === 2 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
              {step > 2 ? "✓" : "2"}
            </div>
            <div className="flex items-center gap-2">
              <SmartphoneIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Налаштувати iOS Shortcut</h3>
            </div>
          </div>

          {/* Endpoint info */}
          <div className="ml-10 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">POST Endpoint</Label>
                <div className="flex gap-1">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/health/screen-time`}
                    className="font-mono text-xs h-8"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={handleCopyEndpoint}>
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Authorization</Label>
                <Input
                  readOnly
                  value={apiToken ? `Bearer ${apiToken.slice(0, 12)}...` : "Bearer <token>"}
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>

            <button
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <BookOpenIcon className="h-3.5 w-3.5" />
              {showInstructions ? "Сховати інструкцію" : "Показати покрокову інструкцію"}
            </button>

            {showInstructions && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4 text-sm">
                <ol className="list-decimal list-inside space-y-3">
                  <li>
                    Відкрий <strong>Shortcuts</strong> (Команди) на iPhone
                  </li>
                  <li>
                    Створи нову команду з діями:
                    <ul className="list-disc list-inside ml-5 mt-1.5 space-y-1 text-muted-foreground">
                      <li><strong>Get Screen Time</strong> — отримати дані за сьогодні</li>
                      <li><strong>Dictionary</strong> — сформувати JSON з даними</li>
                      <li><strong>Get Contents of URL</strong> — POST на endpoint вище</li>
                    </ul>
                  </li>
                  <li>
                    У <strong>Headers</strong> додай:
                    <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">Authorization: Bearer &lt;token&gt;</code>
                  </li>
                  <li>
                    Створи <strong>Automation</strong> → щодня о 23:55 → запуск цієї команди
                  </li>
                </ol>

                <div className="rounded-md bg-background border p-3 font-mono text-xs overflow-x-auto">
                  <p className="text-muted-foreground mb-2 font-sans text-xs font-medium">
                    Приклад JSON body:
                  </p>
                  <pre className="text-foreground/80">{`{
  "date": "2026-04-13",
  "totalMinutes": 187,
  "categories": {
    "social": 45,
    "productivity": 62,
    "entertainment": 38,
    "reading": 22,
    "other": 20
  },
  "topApps": [
    {"name": "Telegram", "minutes": 35},
    {"name": "Safari", "minutes": 28},
    {"name": "Xcode", "minutes": 25},
    {"name": "YouTube", "minutes": 22},
    {"name": "Notes", "minutes": 18}
  ],
  "pickups": 47,
  "notifications": 89
}`}</pre>
                </div>

                <p className="text-muted-foreground text-xs">
                  <strong>Примітка:</strong> iOS Shortcuts має обмежений доступ до категорій Screen Time.
                  Альтернативно можна використовувати macOS <code>knowledgeC.db</code> для автоматичного збору.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Step 3: Done */}
        <Card className={`p-5 transition-all ${step === 3 ? "ring-2 ring-green-500/30" : ""}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === 3 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              {step === 3 ? "✓" : "3"}
            </div>
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Дані на дашборді</h3>
            </div>
            {step === 3 && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-auto">
                Screen Time відображається на вкладці Health
              </span>
            )}
          </div>
          {step < 3 && (
            <p className="text-sm text-muted-foreground ml-10 mt-2">
              Після першого синку дані з&#39;являться на вкладці <strong>Life → Health</strong> у дашборді.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

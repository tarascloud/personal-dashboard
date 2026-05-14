"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// DEV-20260507-0074: After deploy, the client bundle holds stale Server Action
// IDs that no longer exist on the server, producing "Failed to find Server
// Action ... This request might be from an older or newer deployment". A hard
// reload picks up the new bundle. We do this once per session to avoid loops.
const STALE_ACTION_PATTERN = /Failed to find Server Action/i;
const RELOAD_FLAG_KEY = "pd:stale-action-reloaded";

function isStaleServerActionError(err: Error): boolean {
  return STALE_ACTION_PATTERN.test(err.message || "") ||
    STALE_ACTION_PATTERN.test((err as Error & { stack?: string }).stack || "");
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tc = useTranslations("common");

  useEffect(() => {
    console.error("Dashboard error:", error);

    // Auto-recover from stale Server Action references after a fresh deploy.
    if (typeof window !== "undefined" && isStaleServerActionError(error)) {
      try {
        if (sessionStorage.getItem(RELOAD_FLAG_KEY) !== "1") {
          sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
          // Light delay so any logging/toast gets a tick to flush.
          window.setTimeout(() => window.location.reload(), 150);
        }
      } catch {
        // sessionStorage may be unavailable (private mode); reload anyway.
        window.setTimeout(() => window.location.reload(), 150);
      }
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-6 text-destructive" />
          </div>
          <CardTitle>{tc("something_went_wrong")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {error.message || tc("unexpected_error")}
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={reset} variant="outline">
            {tc("retry")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

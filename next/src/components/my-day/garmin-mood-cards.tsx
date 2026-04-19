"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { BatteryFullIcon, DumbbellIcon, HeartPulseIcon, MoonStarIcon, HeartIcon, FrownIcon, MehIcon, AnnoyedIcon, MinusCircleIcon, SmileIcon, LaughIcon } from "lucide-react";
import { GarminData, GarminSleepData, getColorForValue, formatSleepDuration, type MoodIcon } from "./types";

const MOOD_ICONS: Record<MoodIcon, React.ComponentType<{ className?: string }>> = {
  frown: FrownIcon,
  annoyed: AnnoyedIcon,
  meh: MehIcon,
  minus: MinusCircleIcon,
  smile: SmileIcon,
  laugh: LaughIcon,
};

interface GarminMoodCardsProps {
  garmin: GarminData;
  garminSleep: GarminSleepData;
  newLevel: number;
  prevLevel: number;
  moodInfo: { emoji: string; icon: MoodIcon; color: string; label: string };
}

export function GarminMoodCards({
  garmin,
  garminSleep,
  newLevel,
  prevLevel,
  moodInfo,
}: GarminMoodCardsProps) {
  const t = useTranslations("my_day");
  const tc = useTranslations("common");

  // Training readiness advice
  const trAdvice = (score: number) => {
    if (score >= 70) return "full";
    if (score >= 50) return "light";
    return "rest";
  };

  if (!garmin && !garminSleep) return null;

  return (
    <ErrorBoundary moduleName="Garmin & Mood">
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Mood level as first card */}
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                {(() => { const MIcon = MOOD_ICONS[moodInfo.icon]; return <MIcon className="inline size-3.5 mr-0.5" />; })()} {t("mood")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold" style={{ color: moodInfo.color }}>
                {newLevel >= 0 ? "+" : ""}{newLevel.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("yesterday")}: {prevLevel >= 0 ? "+" : ""}{prevLevel.toFixed(1)}
              </p>
            </CardContent>
          </Card>
          {garmin?.bodyBatteryHigh != null && (
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  <BatteryFullIcon className="inline size-3.5 mr-0.5" /> Body Battery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${getColorForValue(garmin.bodyBatteryHigh, { red: 0, yellow: 25, green: 50 })}`}>
                  {garmin.bodyBatteryHigh}%
                </p>
              </CardContent>
            </Card>
          )}
          {garmin?.trainingReadinessScore != null && (
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  <DumbbellIcon className="inline size-3.5 mr-0.5" /> Training Readiness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${getColorForValue(garmin.trainingReadinessScore, { red: 0, yellow: 50, green: 70 })}`}>
                  {garmin.trainingReadinessScore}%
                </p>
                <p className="text-xs text-muted-foreground">{trAdvice(garmin.trainingReadinessScore)}</p>
              </CardContent>
            </Card>
          )}
          {garmin?.hrvLastNight != null && (
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  <HeartPulseIcon className="inline size-3.5 mr-0.5" /> HRV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${getColorForValue(garmin.hrvLastNight, { red: 0, yellow: 30, green: 50 })}`}>
                  {garmin.hrvLastNight}ms
                </p>
              </CardContent>
            </Card>
          )}
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                <MoonStarIcon className="inline size-3.5 mr-0.5" /> {t("sleep_quality")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {garminSleep?.sleepScore != null || garmin?.sleepScore != null ? (
                <>
                  <p className={`text-xl font-bold ${getColorForValue(garminSleep?.sleepScore ?? garmin?.sleepScore ?? 0, { red: 0, yellow: 60, green: 80 })}`}>
                    {garminSleep?.sleepScore ?? garmin?.sleepScore}
                  </p>
                  {garminSleep?.durationSeconds != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatSleepDuration(garminSleep.durationSeconds)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{tc("no_data")}</p>
              )}
            </CardContent>
          </Card>
          {garmin?.restingHr != null && (
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  <HeartIcon className="inline size-3.5 mr-0.5" /> Resting HR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${getColorForValue(garmin.restingHr, { red: 70, yellow: 60, green: 55 }, false)}`}>
                  {garmin.restingHr} bpm
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAthleteProfile, setAthleteProfile, type AthleteProfile } from "@/actions/gym";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormState = Record<keyof AthleteProfile, string>;

const NUMERIC: (keyof AthleteProfile)[] = [
  "heightCm",
  "bodyweightKg",
  "bodyFatPct",
  "weeklyDaysTarget",
  "rirTarget",
  "deloadWeeks",
  "proteinTargetG",
  "caloriesTarget",
];

function toForm(p: AthleteProfile): FormState {
  const f = {} as FormState;
  (Object.keys(p) as (keyof AthleteProfile)[]).forEach((k) => {
    f[k] = p[k] == null ? "" : String(p[k]);
  });
  return f;
}

export default function AthleteProfileCard() {
  const t = useTranslations("gym");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const p = await getAthleteProfile();
      setForm(toForm(p));
    });
  }, []);

  function set(key: keyof AthleteProfile, value: string | null) {
    setForm((prev) => (prev ? { ...prev, [key]: value ?? "" } : prev));
  }

  function handleSave() {
    if (!form) return;
    const payload: Partial<AthleteProfile> = {};
    (Object.keys(form) as (keyof AthleteProfile)[]).forEach((k) => {
      if (k === "updatedAt") return;
      const raw = form[k].trim();
      if (raw === "") {
        (payload as Record<string, unknown>)[k] = null;
      } else if (NUMERIC.includes(k)) {
        const n = parseFloat(raw);
        (payload as Record<string, unknown>)[k] = Number.isFinite(n) ? n : null;
      } else {
        (payload as Record<string, unknown>)[k] = raw;
      }
    });
    startTransition(async () => {
      await setAthleteProfile(payload);
      toast.success(tc("saved"));
    });
  }

  if (!form) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">{tc("loading")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("profile.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      {/* Body metrics */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("profile.section_body")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{t("profile.height_cm")}</Label>
            <Input className="h-8 text-sm" type="number" inputMode="decimal" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="180" />
          </div>
          <div>
            <Label className="text-xs">{t("profile.birth_date")}</Label>
            <Input className="h-8 text-sm" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("profile.sex")}</Label>
            <Select value={form.sex || undefined} onValueChange={(v) => set("sex", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("profile.sex_male")}</SelectItem>
                <SelectItem value="female">{t("profile.sex_female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("profile.bodyweight_kg")}</Label>
            <Input className="h-8 text-sm" type="number" inputMode="decimal" value={form.bodyweightKg} onChange={(e) => set("bodyweightKg", e.target.value)} placeholder="80" />
          </div>
          <div>
            <Label className="text-xs">{t("profile.body_fat_pct")}</Label>
            <Input className="h-8 text-sm" type="number" inputMode="decimal" value={form.bodyFatPct} onChange={(e) => set("bodyFatPct", e.target.value)} placeholder="15" />
          </div>
        </div>
      </div>

      {/* Training */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("profile.section_training")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{t("profile.experience")}</Label>
            <Select value={form.experience || undefined} onValueChange={(v) => set("experience", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">{t("profile.exp_beginner")}</SelectItem>
                <SelectItem value="intermediate">{t("profile.exp_intermediate")}</SelectItem>
                <SelectItem value="advanced">{t("profile.exp_advanced")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("profile.goal")}</Label>
            <Select value={form.goal || undefined} onValueChange={(v) => set("goal", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hypertrophy">{t("profile.goal_hypertrophy")}</SelectItem>
                <SelectItem value="strength">{t("profile.goal_strength")}</SelectItem>
                <SelectItem value="recomp">{t("profile.goal_recomp")}</SelectItem>
                <SelectItem value="maintenance">{t("profile.goal_maintenance")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("profile.nutrition_target")}</Label>
            <Select value={form.nutritionTarget || undefined} onValueChange={(v) => set("nutritionTarget", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bulk">{t("profile.nt_bulk")}</SelectItem>
                <SelectItem value="cut">{t("profile.nt_cut")}</SelectItem>
                <SelectItem value="recomp">{t("profile.nt_recomp")}</SelectItem>
                <SelectItem value="maintain">{t("profile.nt_maintain")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("profile.weekly_days")}</Label>
            <Input className="h-8 text-sm" type="number" min="1" max="7" value={form.weeklyDaysTarget} onChange={(e) => set("weeklyDaysTarget", e.target.value)} placeholder="4" />
          </div>
          <div>
            <Label className="text-xs">{t("profile.rir_target")}</Label>
            <Input className="h-8 text-sm" type="number" min="0" max="5" value={form.rirTarget} onChange={(e) => set("rirTarget", e.target.value)} placeholder="2" />
          </div>
          <div>
            <Label className="text-xs">{t("profile.deload_weeks")}</Label>
            <Input className="h-8 text-sm" type="number" min="3" max="12" value={form.deloadWeeks} onChange={(e) => set("deloadWeeks", e.target.value)} placeholder="6" />
          </div>
        </div>
      </div>

      {/* Nutrition */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("profile.section_nutrition")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{t("profile.protein_g")}</Label>
            <Input className="h-8 text-sm" type="number" value={form.proteinTargetG} onChange={(e) => set("proteinTargetG", e.target.value)} placeholder="150" />
          </div>
          <div>
            <Label className="text-xs">{t("profile.calories")}</Label>
            <Input className="h-8 text-sm" type="number" value={form.caloriesTarget} onChange={(e) => set("caloriesTarget", e.target.value)} placeholder="2600" />
          </div>
        </div>
      </div>

      {/* Context */}
      <div>
        <h3 className="text-sm font-medium mb-2">{t("profile.section_context")}</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("profile.equipment")}</Label>
            <Input className="h-8 text-sm" value={form.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder={t("profile.equipment_ph")} />
          </div>
          <div>
            <Label className="text-xs">{t("profile.activities")}</Label>
            <Textarea className="text-sm" rows={2} value={form.activities} onChange={(e) => set("activities", e.target.value)} placeholder={t("profile.activities_ph")} />
          </div>
          <div>
            <Label className="text-xs">{t("profile.injuries")}</Label>
            <Textarea className="text-sm" rows={2} value={form.injuries} onChange={(e) => set("injuries", e.target.value)} placeholder={t("profile.injuries_ph")} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>{tc("save")}</Button>
        {form.updatedAt && (
          <span className="text-xs text-muted-foreground">
            {t("profile.updated_at")}: {new Date(form.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </Card>
  );
}

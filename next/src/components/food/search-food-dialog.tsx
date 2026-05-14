"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { searchFood, addFoodFromOFF } from "@/actions/food";
import { toast } from "sonner";
import type { OFFProduct } from "@/lib/openfoodfacts";

/**
 * OpenFoodFacts product search dialog with two states:
 * 1. Search list — debounced query, results with product image + nutrition
 * 2. Selected detail — adjustable weight (g) with live macro recalculation
 *
 * On save, calls addFoodFromOFF server action and notifies parent via onSaved.
 * Extracted from food-page.tsx (DEV-20260507-0005).
 */
export function SearchFoodDialog({
  open,
  onOpenChange,
  date,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  onSaved: () => void;
}) {
  const t = useTranslations("food");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OFFProduct | null>(null);
  const [weightG, setWeightG] = useState("100");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setWeightG("100");
      setSearching(false);
      setSaving(false);
    }
  }, [open]);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelected(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const { products } = await searchFood(value.trim(), locale);
          setResults(products);
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [locale],
  );

  const w = parseFloat(weightG) || 0;
  const factor = w / 100;

  const handleSave = async () => {
    if (!selected || w <= 0) return;
    setSaving(true);
    try {
      await addFoodFromOFF({
        barcode: selected.code || undefined,
        productName: selected.name,
        caloriesPer100g: selected.nutriments.calories,
        proteinPer100g: selected.nutriments.proteins,
        fatPer100g: selected.nutriments.fat,
        carbsPer100g: selected.nutriments.carbs,
        weightG: w,
        date,
      });
      toast.success(t("food_added"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(tc("error") ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("search_food")}</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
              {searching ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2">
                      <Skeleton className="size-12 rounded-md shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length > 0 ? (
                results.map((product) => (
                  <button
                    key={product.code}
                    type="button"
                    className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors"
                    onClick={() => {
                      setSelected(product);
                      setWeightG("100");
                    }}
                  >
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="size-12 rounded-md object-cover shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="size-12 rounded-md bg-muted shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                        OFF
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {product.brands ? `${product.brands} · ` : ""}
                        {Math.round(product.nutriments.calories)} kcal/100g
                      </p>
                    </div>
                  </button>
                ))
              ) : query.length >= 2 && !searching ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("no_results")}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {selected.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.image_url}
                  alt={selected.name}
                  className="size-16 rounded-md object-cover shrink-0 bg-muted"
                />
              ) : (
                <div className="size-16 rounded-md bg-muted shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                  OFF
                </div>
              )}
              <div>
                <p className="font-medium">{selected.name}</p>
                {selected.brands && (
                  <p className="text-sm text-muted-foreground">{selected.brands}</p>
                )}
                {selected.serving_size && (
                  <p className="text-xs text-muted-foreground">
                    {t("serving")}: {selected.serving_size}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t("weight_g")}</Label>
              <Input
                type="number"
                value={weightG}
                onChange={(e) => setWeightG(e.target.value)}
                min={1}
                max={10000}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">{t("calories")}</p>
                <p className="text-lg font-bold tabular-nums">
                  {Math.round(selected.nutriments.calories * factor)}
                </p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">{t("protein")}</p>
                <p className="text-lg font-bold tabular-nums text-blue-500">
                  {Math.round(selected.nutriments.proteins * factor)}g
                </p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">{t("fat")}</p>
                <p className="text-lg font-bold tabular-nums text-amber-500">
                  {Math.round(selected.nutriments.fat * factor)}g
                </p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">{t("carbs")}</p>
                <p className="text-lg font-bold tabular-nums text-purple-500">
                  {Math.round(selected.nutriments.carbs * factor)}g
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>
                {tc("back") ?? t("back_to_search")}
              </Button>
              <Button onClick={handleSave} disabled={saving || w <= 0}>
                {saving ? tc("loading") : tc("add")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

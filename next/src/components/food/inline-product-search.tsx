"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchFood } from "@/actions/food";
import type { OFFProduct } from "@/lib/openfoodfacts";

/**
 * Inline autocomplete-style product search used inside the Add Meal dialog.
 * Triggers OpenFoodFacts search after 2+ chars with 400ms debounce, shows top 5
 * suggestions; selecting one fills the parent form via onSelectProduct callback.
 *
 * Extracted from food-page.tsx (DEV-20260507-0005).
 */
export function InlineProductSearch({
  value,
  onChange,
  onSelectProduct,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectProduct: (p: OFFProduct) => void;
  locale: string;
}) {
  const t = useTranslations("food");
  const [suggestions, setSuggestions] = useState<OFFProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = useCallback(
    (val: string) => {
      onChange(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (val.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const { products } = await searchFood(val.trim(), locale);
          setSuggestions(products.slice(0, 5));
          setShowSuggestions(products.length > 0);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 400);
    },
    [onChange, locale],
  );

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={t("search_food_placeholder")}
          className="pl-9"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((p) => (
            <button
              key={p.code}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors"
              onClick={() => {
                onSelectProduct(p);
                setShowSuggestions(false);
                setSuggestions([]);
              }}
            >
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt=""
                  className="size-8 rounded object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.brands && `${p.brands} · `}
                  {p.nutriments.calories} kcal/100g
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

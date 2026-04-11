"use client";

import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountData } from "./finance-types";

interface TransactionInlineFiltersProps {
  filterType: string;
  filterAccount: string;
  filterCategory: string;
  searchQuery: string;
  periodCategories: string[];
  accounts: AccountData[];
  isPending: boolean;
  onFilterTypeChange: (v: string) => void;
  onFilterAccountChange: (v: string) => void;
  onFilterCategoryChange: (v: string) => void;
  onSearchQueryChange: (v: string) => void;
  onApplyFilters: () => void;
}

export function TransactionInlineFilters({
  filterType,
  filterAccount,
  filterCategory,
  searchQuery,
  periodCategories,
  accounts,
  isPending,
  onFilterTypeChange,
  onFilterAccountChange,
  onFilterCategoryChange,
  onSearchQueryChange,
  onApplyFilters,
}: TransactionInlineFiltersProps) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");

  return (
    <Card size="sm" className="mx-4 mb-3 border shadow-none">
      <CardContent>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs">{tc("type")}</Label>
            <Select value={filterType} onValueChange={(v) => onFilterTypeChange(v ?? "")}>
              <SelectTrigger className="h-9 w-[110px]">
                <SelectValue placeholder={tc("all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{tc("all")}</SelectItem>
                <SelectItem value="INCOME">{t("income")}</SelectItem>
                <SelectItem value="EXPENSE">{t("expense")}</SelectItem>
                <SelectItem value="TRANSFER">{t("transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{tc("account")}</Label>
            <Select value={filterAccount} onValueChange={(v) => onFilterAccountChange(v ?? "")}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder={t("all_accounts")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("all_accounts")}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{t("category")}</Label>
            <Select value={filterCategory} onValueChange={(v) => onFilterCategoryChange(v ?? "")}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder={tc("all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{tc("all")}</SelectItem>
                {periodCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">{tc("search")}</Label>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder={tc("search")}
                className="h-9 w-full sm:w-[140px] pl-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && onApplyFilters()}
              />
            </div>
          </div>

          <Button size="sm" onClick={onApplyFilters} disabled={isPending}>
            {tc("filter")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionPaginationProps {
  page: number;
  totalPages: number;
  onGoToPage: (p: number) => void;
}

export function TransactionPagination({ page, totalPages, onGoToPage }: TransactionPaginationProps) {
  const tc = useTranslations("common");

  if (totalPages <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page === 0}
        onClick={() => onGoToPage(page - 1)}
      >
        <ChevronLeftIcon className="size-4" />
        <span className="sr-only">{tc("previous")}</span>
      </Button>
      <span className="text-xs text-muted-foreground">
        {tc("page_of", { page: page + 1, total: totalPages })}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages - 1}
        onClick={() => onGoToPage(page + 1)}
      >
        <ChevronRightIcon className="size-4" />
        <span className="sr-only">{tc("next")}</span>
      </Button>
    </div>
  );
}

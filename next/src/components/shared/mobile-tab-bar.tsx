"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { EllipsisIcon } from "lucide-react";
import { usePinnedNav } from "@/hooks/use-pinned-nav";
import { NavMoreSheet } from "./nav-more-sheet";
import { cn } from "@/lib/utils";

interface MobileTabBarProps {
  userRole?: string;
}

export function MobileTabBar({ userRole }: MobileTabBarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { pinnedItems, overflowItems } = usePinnedNav(userRole);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasOverflow = overflowItems.length > 0;

  const handleMoreClick = useCallback(() => {
    navigator?.vibrate?.(10);
    setSheetOpen((prev) => !prev);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetOpen(false);
  }, []);

  // Check if any overflow item's route is active (to highlight More tab)
  const isOverflowActive = overflowItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      <NavMoreSheet
        items={overflowItems}
        open={sheetOpen}
        onClose={handleSheetClose}
      />

      <nav
        className="fixed bottom-0 inset-x-0 z-50 sm:hidden bg-card/95 backdrop-blur-xl border-t border-border/50"
        aria-label="Main navigation"
      >
        <div
          role="tablist"
          aria-label="Main navigation"
          className="flex min-h-14 pb-[env(safe-area-inset-bottom)]"
        >
          {pinnedItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "page" : undefined}
                aria-label={t(item.key)}
                onClick={() => {
                  navigator?.vibrate?.(10);
                  if (sheetOpen) setSheetOpen(false);
                }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 relative",
                  "min-h-[44px] min-w-[44px]",
                  "active:scale-[0.97] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-lg focus-visible:outline-none",
                  "motion-reduce:transition-none motion-reduce:active:scale-100",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {/* Active indicator pill */}
                <div
                  className={cn(
                    "absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    "motion-reduce:transition-none",
                    isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                  )}
                />

                <item.icon className="size-5 transition-all duration-150 motion-reduce:transition-none" />
                <span
                  className={cn(
                    "text-[10px] leading-tight transition-colors duration-150 motion-reduce:transition-none",
                    isActive ? "font-semibold" : "font-medium"
                  )}
                >
                  {t(item.key)}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            role="tab"
            aria-selected={sheetOpen || isOverflowActive}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            aria-label={t("more")}
            disabled={!hasOverflow}
            onClick={handleMoreClick}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 relative",
              "min-h-[44px] min-w-[44px]",
              "active:scale-[0.97] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-lg focus-visible:outline-none",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
              "disabled:opacity-40 disabled:pointer-events-none",
              sheetOpen || isOverflowActive
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {/* Active indicator pill */}
            <div
              className={cn(
                "absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "motion-reduce:transition-none",
                sheetOpen || isOverflowActive
                  ? "opacity-100 scale-x-100"
                  : "opacity-0 scale-x-0"
              )}
            />

            <EllipsisIcon className="size-5 transition-all duration-150 motion-reduce:transition-none" />
            <span
              className={cn(
                "text-[10px] leading-tight transition-colors duration-150 motion-reduce:transition-none",
                sheetOpen || isOverflowActive ? "font-semibold" : "font-medium"
              )}
            >
              {t("more")}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

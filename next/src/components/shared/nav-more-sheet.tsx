"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NavItem } from "./nav-items";
import { cn } from "@/lib/utils";

interface NavMoreSheetProps {
  items: NavItem[];
  open: boolean;
  onClose: () => void;
}

/** Minimum velocity (px/ms) to trigger dismiss regardless of distance */
const VELOCITY_THRESHOLD = 0.5;
/** Distance threshold (px) to trigger dismiss */
const DISTANCE_THRESHOLD = 80;
/** Drag resistance factor (0-1, lower = more resistance) */
const DRAG_RESISTANCE = 0.55;

export function NavMoreSheet({ items, open, onClose }: NavMoreSheetProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchTime = useRef(0);
  const isDragging = useRef(false);

  // Focus first item when sheet opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        firstItemRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap: keep Tab/Shift+Tab within the sheet
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [open]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Swipe-to-dismiss gesture with velocity tracking
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = now;
    lastTouchY.current = e.touches[0].clientY;
    lastTouchTime.current = now;
    isDragging.current = true;
    setDragY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const now = Date.now();
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;

    // Track velocity (last segment)
    lastTouchY.current = currentY;
    lastTouchTime.current = now;

    if (diff > 0) {
      // Apply resistance: logarithmic dampening for natural rubber-band feel
      const dampened = diff * DRAG_RESISTANCE;
      setDragY(dampened);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Calculate velocity from the last touch segment
    const timeDelta = lastTouchTime.current - dragStartTime.current;
    const distanceDelta = lastTouchY.current - dragStartY.current;
    const velocity = timeDelta > 0 ? distanceDelta / timeDelta : 0;

    // Dismiss on sufficient distance OR sufficient velocity
    if (dragY > DISTANCE_THRESHOLD * DRAG_RESISTANCE || velocity > VELOCITY_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  }, [dragY, onClose]);

  if (!open && dragY === 0) return null;

  const isEmpty = items.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={t("more_menu")}
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-40 max-h-[50vh] rounded-t-2xl bg-card shadow-2xl",
          "transition-transform ease-[cubic-bezier(0.16,1,0.3,1)]",
          open && dragY === 0
            ? "translate-y-0 duration-300"
            : !open
              ? "translate-y-full duration-200"
              : ""
        )}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 mb-4">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center px-6 pb-8 text-muted-foreground">
            <p className="text-sm">{t("no_more_items")}</p>
          </div>
        ) : (
          /* Grid of items */
          <div className="grid grid-cols-3 gap-3 px-6 pb-6" role="menu">
            {items.map((item, index) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  ref={index === 0 ? firstItemRef : undefined}
                  href={item.href}
                  role="menuitem"
                  onClick={() => {
                    navigator?.vibrate?.(5);
                    onClose();
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center min-h-[64px] min-w-[64px] rounded-xl",
                    "active:scale-[0.95] transition-all duration-150",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                    "motion-reduce:transition-none motion-reduce:active:scale-100",
                    "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                  style={{
                    animationDelay: `${index * 30}ms`,
                    animationDuration: "200ms",
                  }}
                >
                  <item.icon className="size-6" />
                  <span
                    className={cn(
                      "text-xs mt-1.5",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {t(item.key)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

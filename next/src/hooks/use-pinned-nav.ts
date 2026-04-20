"use client";

import { DEFAULT_PINNED_TABS, navItems, type NavItem } from "@/components/shared/nav-items";
import { isNavKeyEnabled } from "@/lib/modules";
import { useEnabledModules } from "@/hooks/use-enabled-modules";

/** Phase 2 will use this key for localStorage persistence */
// const STORAGE_KEY = "pd-tab-order";

/**
 * Returns the pinned tabs for the mobile bottom bar and the overflow items
 * for the "More" sheet. Phase 1: fixed order from DEFAULT_PINNED_TABS.
 * Phase 2 will add localStorage persistence for user-customized order.
 */
export function usePinnedNav(userRole?: string): {
  pinnedItems: NavItem[];
  overflowItems: NavItem[];
} {
  const { enabledModules } = useEnabledModules();
  const isOwner = userRole === "owner";

  // Filter nav items by enabled modules and role
  const enabledItems = navItems.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    return isNavKeyEnabled(item.key, enabledModules);
  });

  // Phase 1: fixed pinned order
  const pinnedKeys = DEFAULT_PINNED_TABS as readonly string[];

  const pinnedItems = pinnedKeys
    .map((key) => enabledItems.find((item) => item.key === key))
    .filter((item): item is NavItem => item !== undefined);

  const pinnedKeySet = new Set(pinnedItems.map((item) => item.key));
  const overflowItems = enabledItems.filter(
    (item) => !pinnedKeySet.has(item.key)
  );

  return { pinnedItems, overflowItems };
}

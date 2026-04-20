import type { LucideIcon } from "lucide-react";
import {
  WalletIcon,
  CalendarCheckIcon,
  DumbbellIcon,
  AppleIcon,
  ShoppingCartIcon,
  LayoutDashboardIcon,
  BotMessageSquareIcon,
  SettingsIcon,
  ShieldIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  /** Whether this item can appear as a pinned tab in the mobile bottom bar */
  pinnable?: boolean;
}

export const navItems: NavItem[] = [
  { key: "finance", href: "/finance", icon: WalletIcon, pinnable: true },
  { key: "my_day", href: "/my-day", icon: CalendarCheckIcon, pinnable: true },
  { key: "gym", href: "/gym", icon: DumbbellIcon, pinnable: true },
  { key: "food", href: "/food", icon: AppleIcon, pinnable: true },
  { key: "list", href: "/list", icon: ShoppingCartIcon, pinnable: true },
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon, pinnable: true },
  { key: "ai_chat", href: "/ai-chat", icon: BotMessageSquareIcon, pinnable: true },
  { key: "settings", href: "/settings", icon: SettingsIcon },
  { key: "admin", href: "/admin", icon: ShieldIcon, ownerOnly: true },
];

/** Default pinned tab keys for mobile bottom bar (Phase 1: fixed order) */
export const DEFAULT_PINNED_TABS = ["dashboard", "my_day", "finance", "ai_chat"] as const;

// Finance sub-tabs
export const financeSubTabs = [
  { key: "my_finances", href: "/finance" },
  { key: "investments", href: "/finance/investments" },
  { key: "trading", href: "/trading" },
  { key: "reporting", href: "/reporting" },
];

/**
 * Brand color map for subscription badges.
 * Extracted from subscription-list component so other views can reuse it.
 */

export interface BrandStyle {
  bg: string;
  text: string;
}

export const SUBSCRIPTION_BRAND_COLORS: Record<string, BrandStyle> = {
  "Claude Pro": { bg: "bg-[#d97706]", text: "text-white" },
  "Netflix": { bg: "bg-[#E50914]", text: "text-white" },
  "Spotify": { bg: "bg-[#1DB954]", text: "text-white" },
  "iCloud": { bg: "bg-[#3693F3]", text: "text-white" },
  "YouTube Premium": { bg: "bg-[#FF0000]", text: "text-white" },
  "GitHub": { bg: "bg-[#24292e]", text: "text-white" },
  "Cloudflare": { bg: "bg-[#F38020]", text: "text-white" },
  "Google One": { bg: "bg-[#4285F4]", text: "text-white" },
  "OpenAI": { bg: "bg-[#10a37f]", text: "text-white" },
  "Forus": { bg: "bg-[#2563eb]", text: "text-white" },
  "TIE": { bg: "bg-[#1e3a5f]", text: "text-white" },
  "Amazon Prime": { bg: "bg-[#FF9900]", text: "text-black" },
  "Docker": { bg: "bg-[#2496ED]", text: "text-white" },
  "Duolingo": { bg: "bg-[#58CC02]", text: "text-white" },
  "HomeMoney": { bg: "bg-[#22c55e]", text: "text-white" },
  "Xbox Game Pass": { bg: "bg-[#107C10]", text: "text-white" },
};

export const DEFAULT_BRAND_STYLE: BrandStyle = {
  bg: "bg-muted",
  text: "text-muted-foreground",
};

export function getBrandColors(name: string): BrandStyle {
  if (SUBSCRIPTION_BRAND_COLORS[name]) return SUBSCRIPTION_BRAND_COLORS[name];
  for (const key of Object.keys(SUBSCRIPTION_BRAND_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase()))
      return SUBSCRIPTION_BRAND_COLORS[key];
  }
  return DEFAULT_BRAND_STYLE;
}

import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// AI training crawlers — block from training on this content
// (REV-2026-05-03-100). User-agents drawn from each crawler's public docs.
const AI_BOTS = [
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "FacebookBot",
  "cohere-ai",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  if (host === "dev.taras.cloud") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/finance/", "/gym/", "/settings/", "/login"],
      },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, disallow: "/" })),
    ],
    sitemap: "https://pd.taras.cloud/sitemap.xml",
  };
}
